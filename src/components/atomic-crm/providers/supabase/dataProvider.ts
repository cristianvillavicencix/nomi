import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  DealPipeline,
  PhoneNumberAndType,
  RAFile,
  OrganizationMember,
  OrganizationMemberFormData,
  SignUpData,
  EmailAndType,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { withCurrentProductName } from "../../root/defaultConfiguration";
import { getActivityLog } from "../commons/activity";
import {
  persistTaskAssignmentSideEffects,
  prepareTaskWriteData,
  taskAssignmentFieldsChanged,
} from "../../tasks/persistTaskAssignmentSideEffects";
import { invalidateResourceQueries } from "../queryInvalidation";
import { prepareCalendarEventWriteData } from "@/lbs/calendar/calendarEventWriteData";
import type { GetScopedTasksParams } from "../../tasks/scopedTasks";
import {
  collectMyProjectDealIds,
  filterScopedTasks,
} from "../../tasks/scopedTasksFilter";
import {
  groupTaskParticipantsByTaskId,
  scopeUsesUserCompletionFilter,
} from "../../tasks/taskUserCompletion";
import type { TaskParticipant } from "../../types";
import type { Task } from "../../types";
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";
import { canApprovePayroll } from "@/payroll/permissions";
import { canMutateCrmResource } from "../commons/crmPermissions";
import {
  buildCompanyPayloadFromUpsert,
  buildContactPayloadFromUpsert,
  splitClientFullName,
  type LbsClientUpsertInput,
  type LbsClientUpsertResult,
} from "@/lbs/clients/lbsClientUpsert";

if (import.meta.env.VITE_SUPABASE_URL === undefined) {
  throw new Error("Please set the VITE_SUPABASE_URL environment variable");
}
if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
  throw new Error(
    "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
  );
}

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
  supabaseClient: supabase,
  sortOrder: "asc,desc.nullslast" as any,
});

const invokeEdgeFunction = async <TData = unknown>(
  functionName: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) => {
  const getSessionToken = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token;
  };

  const invokeWithToken = async (token?: string) =>
    supabase.functions.invoke<TData>(functionName, {
      ...options,
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  const token = await getSessionToken();
  let result = await invokeWithToken(token);

  const status = result.error?.context?.status;
  if (status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retryToken = refreshed.data.session?.access_token;
    result = await invokeWithToken(retryToken);
  }

  return result;
};

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const resolveOrganizationMemberId = async (
  id: Identifier,
): Promise<Identifier> => {
  if (typeof id !== "string" || !looksLikeUuid(id)) {
    return id;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", id)
    .single();

  if (error || !data?.id) {
    return id;
  }

  return data.id as Identifier;
};

const getCurrentMutationIdentity = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return null;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id, administrator, roles, module_permissions")
    .eq("user_id", authUserId)
    .single();

  if (!member) return null;

  return {
    id: member.id,
    administrator: member.administrator === true,
    role: member.administrator ? "admin" : (member.roles?.[0] ?? "user"),
    roles: member.roles ?? (member.administrator ? ["admin"] : []),
    module_permissions: member.module_permissions ?? null,
  };
};

const assertMutationAllowed = async (
  resource: string,
  action: "create" | "update" | "delete",
  params: any,
) => {
  const identity =
    params?.meta?.identity ?? (await getCurrentMutationIdentity());
  const data = params?.data ?? params?.previousData ?? {};

  if (
    !canMutateCrmResource({
      identity,
      resource,
      action,
      data,
    })
  ) {
    throw new Error("No tienes permiso para esta acción");
  }

  return identity;
};

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const normalizeEmailValue = (value?: string | null, label = "email") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!isValidEmail(trimmed)) {
    throw new Error(`Invalid ${label}`);
  }

  return trimmed;
};

const normalizePhoneValue = (value?: string | null, label = "phone") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeUsPhoneToE164(trimmed);
  if (!normalized) {
    throw new Error(`Invalid ${label}. Use 10 digits`);
  }

  return normalized;
};

const normalizeEmailEntries = (entries?: EmailAndType[]) =>
  entries
    ?.map((entry) => {
      const email = normalizeEmailValue(entry.email, "email");
      return email ? { ...entry, email } : null;
    })
    .filter((entry): entry is EmailAndType => entry != null);

const normalizePhoneEntries = (entries?: PhoneNumberAndType[]) =>
  entries
    ?.map((entry) => {
      const number = normalizePhoneValue(entry.number);
      return number ? { ...entry, number } : null;
    })
    .filter((entry): entry is PhoneNumberAndType => entry != null);

const normalizeContactData = <
  T extends {
    email_jsonb?: EmailAndType[];
    phone_jsonb?: PhoneNumberAndType[];
  },
>(
  data: T,
): T => ({
  ...data,
  email_jsonb: normalizeEmailEntries(data.email_jsonb),
  phone_jsonb: normalizePhoneEntries(data.phone_jsonb),
});

const getOneFromResourceMaybeSingle = async (
  resource: string,
  id: Identifier,
) => {
  const { data, error } = await supabase
    .from(resource)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * PostgREST returns 406 (object+json coercion) when an update matches 0 rows under RLS.
 * Use `.maybeSingle()` plus a clear server message instead of relying on react-admin PATCH.
 */
const patchSingletonConfigurationRow = async (
  config: ConfigurationContextValue,
) => {
  const { data, error } = await supabase
    .from("configuration")
    .update({ config })
    .eq("id", 1)
    .select()
    .maybeSingle();

  if (error) {
    console.error("configuration.update", error);
    throw new Error(error.message || "Failed to save configuration");
  }
  if (data == null) {
    throw new Error(
      "Could not save workspace settings. You must be a company administrator to edit configuration.",
    );
  }

  return data;
};

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  async create(resource: string, params: any) {
    await assertMutationAllowed(resource, "create", params);
    return baseDataProvider.create(resource, params);
  },
  async update(resource: string, params: any) {
    const identity = await assertMutationAllowed(resource, "update", params);
    if (
      resource === "time_entries" &&
      params?.data?.status === "approved" &&
      !canApprovePayroll(params?.meta?.identity ?? identity)
    ) {
      throw new Error("Only owner/admin/accountant can approve time entries");
    }

    if (resource === "configuration") {
      const nested = params?.data?.config;
      const nextConfig =
        nested != null && typeof nested === "object"
          ? (nested as ConfigurationContextValue)
          : (params?.data as ConfigurationContextValue);
      const data = await patchSingletonConfigurationRow(nextConfig);
      return { data };
    }

    return baseDataProvider.update(resource, params);
  },
  async updateMany(resource: string, params: any) {
    const identity = await assertMutationAllowed(resource, "update", params);
    if (
      resource === "time_entries" &&
      params?.data?.status === "approved" &&
      !canApprovePayroll(params?.meta?.identity ?? identity)
    ) {
      throw new Error("Only owner/admin/accountant can approve time entries");
    }

    return baseDataProvider.updateMany(resource, params);
  },
  async delete(resource: string, params: any) {
    await assertMutationAllowed(resource, "delete", params);
    return baseDataProvider.delete(resource, params);
  },
  async deleteMany(resource: string, params: any) {
    await assertMutationAllowed(resource, "delete", params);
    return baseDataProvider.deleteMany(resource, params);
  },
  async getList(resource: string, params: GetListParams) {
    let request = params;
    if (
      resource === "time_entries" &&
      params.filter &&
      typeof params.filter === "object" &&
      "__hours_all_statuses" in params.filter
    ) {
      const { __hours_all_statuses: _legacy, ...rest } =
        params.filter as Record<string, unknown>;
      request = { ...params, filter: rest };
    }

    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", request);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", request);
    }

    return baseDataProvider.getList(resource, request);
  },
  async getOne(resource: string, params: any) {
    if (params?.id == null) {
      throw new Error(`Missing id for getOne(${resource})`);
    }

    if (resource === "companies") {
      const summaryRecord = await getOneFromResourceMaybeSingle(
        "companies_summary",
        params.id,
      );
      if (summaryRecord) {
        return { data: summaryRecord };
      }
      return baseDataProvider.getOne("companies", params);
    }
    if (resource === "contacts") {
      const summaryRecord = await getOneFromResourceMaybeSingle(
        "contacts_summary",
        params.id,
      );
      if (summaryRecord) {
        return { data: summaryRecord };
      }
      return baseDataProvider.getOne("contacts", params);
    }

    return baseDataProvider.getOne(resource, params);
  },

  async signUp(_data: SignUpData) {
    throw new Error(
      "El registro público está deshabilitado. Pide a tu administrador una invitación desde Configuración → Usuarios.",
    );
  },
  async organizationMemberCreate(body: OrganizationMemberFormData) {
    const { password: _password, ...rest } = body;
    const normalizedBody = {
      ...rest,
      email: normalizeEmailValue(body.email, "email")!,
      roles: Array.isArray(body.roles) ? Array.from(new Set(body.roles)) : [],
    };
    const { data, error } = await invokeEdgeFunction<{
      data: OrganizationMember;
    }>("users", {
      method: "POST",
      body: normalizedBody,
    });

    if (!data || error) {
      console.error("organizationMemberCreate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to create the user");
    }

    return data.data;
  },
  async organizationMemberUpdate(
    id: Identifier,
    data: Partial<Omit<OrganizationMemberFormData, "password">>,
  ) {
    const orgMemberId = await resolveOrganizationMemberId(id);
    const {
      email,
      first_name,
      last_name,
      administrator,
      roles,
      module_permissions,
      avatar,
      disabled,
    } = data;

    let persistedAvatar = avatar;
    if (persistedAvatar?.rawFile instanceof File) {
      persistedAvatar = await uploadToBucket(persistedAvatar);
    }

    const { data: updatedData, error } = await invokeEdgeFunction<{
      data: OrganizationMember;
    }>("users", {
      method: "PATCH",
      body: {
        organization_member_id: orgMemberId,
        email: normalizeEmailValue(email, "email"),
        first_name,
        last_name,
        administrator,
        roles: Array.isArray(roles) ? Array.from(new Set(roles)) : undefined,
        ...(module_permissions !== undefined ? { module_permissions } : {}),
        disabled,
        avatar: persistedAvatar,
      },
    });

    if (!updatedData || error) {
      console.error("organizationMemberUpdate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Failed to update account manager",
      );
    }

    return updatedData.data;
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } = await invokeEdgeFunction<boolean>(
      "update_password",
      {
        method: "PATCH",
        body: {
          organization_member_id: id,
        },
      },
    );

    if (error) {
      console.error("update_password.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(
        errorDetails?.message || "Failed to send password reset email",
      );
    }

    return passwordUpdated;
  },
  async unarchiveDeal(deal: Deal) {
    // get all deals where stage is the same as the deal to unarchive
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return await Promise.all(
      updatedDeals.map((updatedDeal) =>
        baseDataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  async getActivityLog(companyId?: Identifier) {
    return getActivityLog(baseDataProvider, companyId);
  },
  async isInitialized() {
    return getIsInitialized();
  },
  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { data, error } = await invokeEdgeFunction("merge_contacts", {
      method: "POST",
      body: { loserId: sourceId, winnerId: targetId },
    });

    if (error) {
      console.error("merge_contacts.error", error);
      throw new Error("Failed to merge contacts");
    }

    return data;
  },
  async acceptProposal({ id }: { id: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      deal_id: number;
      proposal_id: number;
    }>("accept_proposal", {
      method: "POST",
      body: { proposal_id: id },
    });

    if (error || !data?.deal_id) {
      console.error("accept_proposal.error", error);
      throw new Error("Failed to accept proposal");
    }

    return data;
  },
  async upsertLbsClient(
    input: LbsClientUpsertInput,
  ): Promise<LbsClientUpsertResult> {
    const memberId = await resolveOrganizationMemberId(
      input.organizationMemberId,
    );
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("id, org_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member?.org_id) {
      throw new Error("Organization member not found");
    }

    const companyName = input.business.name.trim();
    const { firstName, lastName } = splitClientFullName(input.primary.fullName);
    let created = false;

    type ExistingCompany = {
      id: Identifier;
      context_links: string[] | null;
      primary_contact_id: Identifier | null;
    };

    let existingCompany: ExistingCompany | null = null;

    if (input.companyId) {
      const { data, error } = await supabase
        .from("companies")
        .select("id, context_links, primary_contact_id")
        .eq("id", input.companyId)
        .eq("org_id", member.org_id)
        .maybeSingle();

      if (error || !data?.id) {
        throw new Error("Client not found");
      }
      existingCompany = data as ExistingCompany;
    } else {
      const { data } = await supabase
        .from("companies")
        .select("id, context_links, primary_contact_id")
        .eq("org_id", member.org_id)
        .ilike("name", companyName)
        .limit(1)
        .maybeSingle();

      existingCompany = (data as ExistingCompany | null) ?? null;
    }

    const companyPayload = buildCompanyPayloadFromUpsert(
      input,
      existingCompany?.context_links ?? undefined,
    );

    let companyId: Identifier;
    if (existingCompany?.id) {
      const { data: updatedCompany, error: updateCompanyError } = await supabase
        .from("companies")
        .update(companyPayload)
        .eq("id", existingCompany.id)
        .select("id")
        .single();

      if (updateCompanyError || !updatedCompany) {
        throw new Error("Failed to update client company");
      }
      companyId = updatedCompany.id;
    } else {
      const { data: newCompany, error: createCompanyError } = await supabase
        .from("companies")
        .insert({
          org_id: member.org_id,
          sector: "information-technology",
          ...companyPayload,
        })
        .select("id")
        .single();

      if (createCompanyError || !newCompany) {
        throw new Error("Failed to create client company");
      }
      companyId = newCompany.id;
      created = true;
    }

    const contactPayload = buildContactPayloadFromUpsert(input, companyId);

    const resolvePrimaryContactId = async () => {
      if (input.primaryContactId) {
        const { data: existingPrimary } = await supabase
          .from("contacts")
          .select("id")
          .eq("id", input.primaryContactId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (existingPrimary?.id) {
          const { data: updatedContact, error: updateContactError } =
            await supabase
              .from("contacts")
              .update(contactPayload)
              .eq("id", existingPrimary.id)
              .select("id")
              .single();

          if (updateContactError || !updatedContact) {
            throw new Error("Failed to update primary contact");
          }
          return updatedContact.id as Identifier;
        }
      }

      const primaryEmail = input.primary.email?.trim().toLowerCase();
      if (primaryEmail) {
        const { data: contactsByCompany } = await supabase
          .from("contacts")
          .select("id, email_jsonb")
          .eq("company_id", companyId);

        const matchedByEmail = contactsByCompany?.find((contact) =>
          (contact.email_jsonb as { email?: string }[] | null)?.some(
            (entry) => entry.email?.trim().toLowerCase() === primaryEmail,
          ),
        );

        if (matchedByEmail?.id) {
          const { data: updatedContact, error: updateContactError } =
            await supabase
              .from("contacts")
              .update(contactPayload)
              .eq("id", matchedByEmail.id)
              .select("id")
              .single();

          if (updateContactError || !updatedContact) {
            throw new Error("Failed to update primary contact");
          }
          return updatedContact.id as Identifier;
        }
      }

      const { data: existingByName } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .ilike("first_name", firstName)
        .ilike("last_name", lastName || firstName)
        .limit(1)
        .maybeSingle();

      if (existingByName?.id) {
        const { data: updatedContact, error: updateContactError } =
          await supabase
            .from("contacts")
            .update(contactPayload)
            .eq("id", existingByName.id)
            .select("id")
            .single();

        if (updateContactError || !updatedContact) {
          throw new Error("Failed to update primary contact");
        }
        return updatedContact.id as Identifier;
      }

      const { data: newContact, error: createContactError } = await supabase
        .from("contacts")
        .insert({
          org_id: member.org_id,
          ...contactPayload,
        })
        .select("id")
        .single();

      if (createContactError || !newContact) {
        throw new Error("Failed to create primary contact");
      }
      return newContact.id as Identifier;
    };

    const contactId = await resolvePrimaryContactId();

    const { error: primaryLinkError } = await supabase
      .from("companies")
      .update({ primary_contact_id: contactId })
      .eq("id", companyId);

    if (primaryLinkError) {
      throw new Error("Failed to link primary contact");
    }

    return { company_id: companyId, contact_id: contactId, created };
  },
  async convertLeadToClient({
    contactId,
    companyName,
  }: {
    contactId: Identifier;
    companyName: string;
  }) {
    const trimmedName = companyName.trim();
    if (trimmedName.length < 2) {
      throw new Error("Company name must be at least 2 characters");
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, organization_member_id, company_id, org_id",
      )
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      throw new Error("Lead not found");
    }

    let companyId = contact.company_id as Identifier | null;

    if (companyId) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id, primary_contact_id")
        .eq("id", companyId)
        .single();

      if (existingCompany?.id) {
        companyId = existingCompany.id;
      } else {
        companyId = null;
      }
    }

    if (!companyId) {
      const orgId = contact.org_id;
      const { data: existingByName } = orgId
        ? await supabase
            .from("companies")
            .select("id, primary_contact_id")
            .eq("org_id", orgId)
            .ilike("name", trimmedName)
            .limit(1)
            .maybeSingle()
        : { data: null };

      if (existingByName?.id) {
        companyId = existingByName.id;
      } else {
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: trimmedName,
            organization_member_id: contact.organization_member_id,
            org_id: contact.org_id,
            sector: "information-technology",
          })
          .select("id, primary_contact_id")
          .single();

        if (companyError || !company) {
          throw new Error("Failed to create client company");
        }
        companyId = company.id;
      }
    }

    const { data: companyRecord } = await supabase
      .from("companies")
      .select("primary_contact_id")
      .eq("id", companyId)
      .single();

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        company_id: companyId,
        status: "client",
      })
      .eq("id", contactId);

    if (updateError) {
      throw new Error("Failed to convert lead");
    }

    if (!companyRecord?.primary_contact_id) {
      await supabase
        .from("companies")
        .update({ primary_contact_id: contactId })
        .eq("id", companyId);
    }

    return { company_id: companyId, contact_id: contactId };
  },
  async getPublicDealBrief(payload: {
    dealId: string | number;
    companyId: string | number;
    contactId: string | number;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      project_type?: string | null;
      expected_end_date?: string | null;
      website_brief?: Record<string, string | null>;
    }>("get_public_deal_brief", {
      body: {
        deal_id: Number(payload.dealId),
        company_id: Number(payload.companyId),
        contact_id: Number(payload.contactId),
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data) {
      console.error("get_public_deal_brief.error", error);
      throw new Error("Failed to load project brief");
    }

    return data;
  },
  async getGithubRepoStatus(payload: { dealId: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      slug: string;
      repo_url: string | null;
      default_branch: string | null;
      last_commit: {
        sha: string;
        short_sha: string;
        message: string;
        author: string;
        date: string | null;
        url: string;
      } | null;
      latest_run: {
        status: string | null;
        conclusion: string | null;
        workflow_name: string | null;
        updated_at: string | null;
        url: string | null;
      } | null;
      github_token_configured: boolean;
      error?: string | null;
    }>("get_github_repo_status", {
      method: "POST",
      body: { deal_id: Number(payload.dealId) },
    });

    if (error || !data) {
      console.error("get_github_repo_status.error", error);
      throw new Error("Failed to load GitHub repository status");
    }

    return data;
  },
  async submitProjectResources(payload: {
    dealId: string | number;
    companyId?: string | number | null;
    contactId?: string | number | null;
    items: Array<{
      category: string;
      label?: string;
      name: string;
      content: string;
      content_type?: string;
    }>;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      deal_id: number;
      count: number;
    }>("submit_project_resources", {
      body: {
        deal_id: Number(payload.dealId),
        company_id: payload.companyId ? Number(payload.companyId) : undefined,
        contact_id: payload.contactId ? Number(payload.contactId) : undefined,
        items: payload.items,
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data) {
      console.error("submit_project_resources.error", error);
      throw new Error("Failed to upload project resources");
    }

    return data;
  },
  async getFormByToken(payload: { token: string }) {
    const { data, error } = await supabase.functions.invoke<{
      token: string;
      is_preview?: boolean;
      form: {
        id: number;
        name: string;
        slug: string;
        description?: string | null;
        schema: Record<string, unknown>;
        type: string;
        logo_url?: string | null;
        primary_color?: string | null;
        background_image_url?: string | null;
        welcome_title?: string | null;
        welcome_message?: string | null;
        thank_you_title?: string | null;
        thank_you_message?: string | null;
        recaptcha_enabled?: boolean;
        honeypot_enabled?: boolean;
        custom_font_url?: string | null;
        custom_css?: string | null;
      };
      prefill?: Record<string, unknown>;
      links?: {
        contact_id?: number | null;
        company_id?: number | null;
        deal_id?: number | null;
      };
    }>("get_form_by_token", {
      body: { token: payload.token },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data?.form) {
      console.error("get_form_by_token.error", error);
      throw new Error("Form not found or link expired");
    }

    return data;
  },
  async submitFormV2(payload: {
    token: string;
    answers: Record<string, unknown>;
    recaptchaToken?: string;
    honeypot?: string;
    metadata?: {
      source_url?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      app_base_url?: string;
    };
  }) {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      preview?: boolean;
      error?: string;
      details?: string[];
      submission_id?: number;
      thank_you_title?: string;
      thank_you_message?: string;
      redirect_url?: string | null;
    }>("submit_form_v2", {
      body: {
        token: payload.token,
        answers: payload.answers,
        recaptcha_token: payload.recaptchaToken,
        honeypot: payload.honeypot,
        metadata: {
          ...payload.metadata,
          app_base_url:
            payload.metadata?.app_base_url ?? window.location.origin,
          source_url: payload.metadata?.source_url ?? window.location.href,
        },
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data?.ok) {
      const detail = data?.details?.length
        ? `: ${data.details.join(", ")}`
        : "";
      const message = (data?.error ?? "Failed to submit form") + detail;
      console.error("submit_form_v2.error", error ?? message);
      throw new Error(message);
    }

    return data;
  },
  async generateFormToken(payload: {
    formInstanceId: number;
    contactId?: number | null;
    companyId?: number | null;
    dealId?: number | null;
    expiresInDays?: number;
    maxUses?: number | null;
    baseUrl?: string;
    isPreview?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      short_code?: string;
      url: string;
      short_url?: string;
      expires_at: string;
      max_uses: number | null;
      form_instance_id: number;
      form_name: string;
    }>("generate_form_token", {
      method: "POST",
      body: {
        form_instance_id: payload.formInstanceId,
        contact_id: payload.contactId ?? null,
        company_id: payload.companyId ?? null,
        deal_id: payload.dealId ?? null,
        expires_in_days: payload.expiresInDays ?? 30,
        max_uses: payload.maxUses ?? 1,
        base_url: payload.baseUrl ?? window.location.origin,
        is_preview: payload.isPreview ?? false,
      },
    });

    if (error || !data?.token) {
      console.error("generate_form_token.error", error);
      throw new Error("Failed to generate form link");
    }

    return data;
  },
  async recordFormEvent(payload: {
    token: string;
    event_type: "started" | "field_completed" | "field_focused" | "abandoned";
    field_key?: string;
  }) {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(
      "record_form_event",
      {
        body: payload,
        headers: {
          apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        },
      },
    );

    if (error) {
      console.error("record_form_event.error", error);
      throw new Error("Failed to record form event");
    }

    if (!data?.ok) {
      throw new Error("Failed to record form event");
    }

    return data;
  },
  /**
   * Usa el cliente de Supabase con `.maybeSingle()` en lugar de `getOne` del data provider.
   * Sin sesión, RLS no devuelve filas: PostgREST respondía 406 (Accept object+json) al esperar
   * exactamente un registro. Esto afecta /login, /sas y otras rutas anónimas.
   */
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data, error } = await supabase
      .from("configuration")
      .select("config")
      .eq("id", 1)
      .maybeSingle();
    if (error || data == null) {
      return withCurrentProductName({}) as ConfigurationContextValue;
    }
    const raw = (data.config as ConfigurationContextValue) ?? {};
    return withCurrentProductName(raw) as ConfigurationContextValue;
  },
  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const row = await patchSingletonConfigurationRow(config);
    return row.config as ConfigurationContextValue;
  },
  async syncOrganizationPipelineStages(
    pipelines: DealPipeline[],
  ): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData.session?.user?.id;
    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("id, org_id")
      .eq("user_id", authUserId)
      .single();

    if (memberError || !member?.org_id) {
      throw new Error("Organization member not found");
    }

    for (const pipeline of pipelines) {
      const { error: deleteError } = await supabase
        .from("organization_pipeline_stages")
        .delete()
        .eq("org_id", member.org_id)
        .eq("pipeline_id", pipeline.id);

      if (deleteError) {
        console.error("syncOrganizationPipelineStages.delete", deleteError);
        throw new Error("Failed to reset pipeline stages");
      }

      const rows = pipeline.stages.map((stage, index) => {
        const label = stage.label.toLowerCase();
        return {
          org_id: member.org_id,
          pipeline_id: pipeline.id,
          key: stage.id,
          label: stage.label,
          color: stage.color || "#64748b",
          order_index: stage.order ?? index + 1,
          is_won:
            stage.id === "won" ||
            stage.id === "closed_won" ||
            label.includes("won"),
          is_lost: stage.id === "closed_lost" || label.includes("closed lost"),
        };
      });

      if (rows.length === 0) continue;

      const { error: insertError } = await supabase
        .from("organization_pipeline_stages")
        .insert(rows);

      if (insertError) {
        console.error("syncOrganizationPipelineStages.insert", insertError);
        throw new Error("Failed to save pipeline stages");
      }
    }

    invalidateResourceQueries("organization_pipeline_stages");
  },
  async generatePaymentLines(paymentId: Identifier): Promise<number> {
    const { data, error } = await supabase.rpc("generate_payment_lines", {
      p_payment_id: paymentId,
    });

    if (error) {
      console.error("generate_payment_lines.error", error);
      throw new Error("Failed to generate payment lines");
    }

    return Number(data ?? 0);
  },
  async generatePayrollRun(payrollRunId: Identifier): Promise<number> {
    const { data, error } = await supabase.rpc("generate_payroll_run", {
      p_payroll_run_id: payrollRunId,
    });

    if (error) {
      console.error("generate_payroll_run.error", error);
      throw new Error("Failed to generate payroll run lines");
    }

    return Number(data ?? 0);
  },
  async releasePayrollRunLinkedResources(
    payrollRunId: Identifier,
  ): Promise<void> {
    const { error } = await supabase.rpc(
      "release_payroll_run_linked_resources",
      {
        p_run_id: payrollRunId,
      },
    );

    if (error) {
      console.error("release_payroll_run_linked_resources.error", error);
      throw new Error(
        error.message ?? "Failed to release hours for this payroll run",
      );
    }
  },
  async stripeCreateCheckoutSession(params: {
    orgId: number;
    returnPath?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      url?: string;
      id?: string;
    }>("stripe-billing", {
      method: "POST",
      body: {
        action: "create_checkout",
        org_id: params.orgId,
        return_path: params.returnPath ?? "/sas",
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to start Stripe checkout",
      );
    }
    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return data;
  },
  async stripeBillingPortal(params: { orgId: number; returnPath?: string }) {
    const { data, error } = await invokeEdgeFunction<{ url?: string }>(
      "stripe-billing",
      {
        method: "POST",
        body: {
          action: "billing_portal",
          org_id: params.orgId,
          return_path: params.returnPath ?? "/sas",
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to open billing portal",
      );
    }
    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return data;
  },
  async stripeSyncSeats(params: { orgId: number }) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      quantity?: number;
      skipped?: boolean;
    }>("stripe-billing", {
      method: "POST",
      body: { action: "sync_seats", org_id: params.orgId },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to sync seats to Stripe",
      );
    }
    return data;
  },
  async stripeAddOneSeat(params: { orgId: number; returnPath?: string }) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      quantity?: number;
      previous?: number;
    }>("stripe-billing", {
      method: "POST",
      body: {
        action: "add_one_seat",
        org_id: params.orgId,
        return_path: params.returnPath ?? "/settings?tab=users",
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to add a seat in Stripe",
      );
    }
    return data;
  },
  async getPlatformAuthUsers() {
    const { data, error } = await invokeEdgeFunction<{
      users: Array<{
        id: string;
        email: string | null;
        created_at: string;
        last_sign_in_at: string | null;
        email_confirmed_at: string | null;
      }>;
      total: number;
    }>("platform-directory", { method: "POST", body: {} });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to list auth users",
      );
    }
    return data ?? { users: [], total: 0 };
  },
  async getScopedTasks(params: GetScopedTasksParams) {
    const usesUserCompletion = scopeUsesUserCompletionFilter(params.scope);
    let query = supabase.from("tasks").select("*", { count: "exact" });

    if (!usesUserCompletion) {
      if (params.status === "open") {
        query = query.is("done_date", null);
      } else {
        query = query.not("done_date", "is", null);
      }
    }

    if (params.typeFilter && params.typeFilter !== "all") {
      query = query.eq("type", params.typeFilter);
    }
    if (params.priorityFilter && params.priorityFilter !== "all") {
      query = query.eq("priority", params.priorityFilter);
    }
    if (params.projectId != null && params.projectId !== "") {
      query = query.eq("deal_id", params.projectId);
    }

    if (params.scope === "mine") {
      const orParts = [
        `organization_member_id.eq.${params.organizationMemberId}`,
      ];
      orParts.push(`mentioned_member_ids.cs.{${params.organizationMemberId}}`);
      if (params.personId != null) {
        orParts.push(`assignee_person_ids.cs.{${params.personId}}`);
        orParts.push(`collaborator_person_ids.cs.{${params.personId}}`);
      }
      query = query.or(orParts.join(","));
    } else if (params.scope === "my_projects") {
      const dealIds = (params.projectDealIds ?? [])
        .map(Number)
        .filter(Number.isFinite);
      if (dealIds.length === 0) {
        return { data: [], total: 0 };
      }
      query = query.in("deal_id", dealIds);
    }

    const sortField = params.sort?.field ?? "due_date";
    const ascending = params.sort?.order !== "DESC";
    query = query.order(sortField, { ascending, nullsFirst: false });

    if (!usesUserCompletion) {
      const page = params.pagination?.page ?? 1;
      const perPage = params.pagination?.perPage ?? 200;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);
    }

    const { data: rawTasks, count, error } = await query;
    if (error) {
      console.error("getScopedTasks.error", error);
      throw new Error("Failed to load tasks");
    }

    const tasks = (rawTasks ?? []) as Task[];
    let participantsByTaskId: Record<string, TaskParticipant[]> = {};

    if (usesUserCompletion && tasks.length > 0) {
      const taskIds = tasks.map((task) => task.id);
      const { data: participants, error: participantsError } = await supabase
        .from("task_participants")
        .select("*")
        .in("task_id", taskIds);

      if (participantsError) {
        console.error("getScopedTasks.participants.error", participantsError);
        throw new Error("Failed to load task participants");
      }

      participantsByTaskId = groupTaskParticipantsByTaskId(
        (participants ?? []) as TaskParticipant[],
      );

      const filtered = filterScopedTasks(tasks, params, participantsByTaskId);
      return filtered;
    }

    return {
      data: tasks,
      total: count ?? tasks.length,
    };
  },
  async getMyProjectDealIds(params: {
    organizationMemberId: Identifier;
    personId?: Identifier | null;
  }) {
    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, organization_member_id, salesperson_ids");

    if (error) {
      console.error("getMyProjectDealIds.error", error);
      throw new Error("Failed to load projects");
    }

    return collectMyProjectDealIds(
      deals ?? [],
      params.organizationMemberId,
      params.personId,
    );
  },
  async ensureProjectConversation(params: {
    dealId: Identifier;
    title?: string;
  }) {
    const { data, error } = await supabase.rpc("ensure_project_conversation", {
      p_deal_id: params.dealId,
      p_title: params.title?.trim() || null,
    });

    if (error) {
      console.error("ensureProjectConversation.error", error);
      throw new Error(error.message || "Failed to open project team chat");
    }

    return data as Identifier;
  },
  async getMessagingSettings() {
    const disabledSettings: import("@/lbs/types").MessagingSettingsPublic = {
      org_id: 0,
      twilio_account_sid: null,
      twilio_phone_number: null,
      sms_enabled: false,
      has_auth_token: false,
      webhook_url: null,
    };

    const { data, error } = await invokeEdgeFunction<
      import("@/lbs/types").MessagingSettingsPublic
    >("messaging_settings", {
      method: "POST",
      body: { action: "get" },
    });
    if (error || !data) {
      console.warn("getMessagingSettings.error", error);
      return disabledSettings;
    }
    return data;
  },
  async updateMessagingSettings(params: {
    twilio_account_sid?: string | null;
    twilio_auth_token?: string | null;
    twilio_phone_number?: string | null;
    sms_enabled?: boolean;
    business_hours?: import("@/lbs/types").BusinessHoursConfig | null;
    out_of_hours_message?: string | null;
    auto_acknowledge_enabled?: boolean;
    auto_acknowledge_message?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<
      import("@/lbs/types").MessagingSettingsPublic
    >("messaging_settings", {
      method: "POST",
      body: {
        action: "update",
        ...params,
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save messaging settings",
      );
    }
    if (!data) {
      throw new Error("Failed to save messaging settings");
    }
    return data;
  },
  async sendTestSms(testPhone: string) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "messaging_settings",
      {
        method: "POST",
        body: {
          action: "test_sms",
          test_phone: testPhone,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send test SMS",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to send test SMS");
    }
    return data;
  },
  async getAccessEntryPassword(entryId: Identifier) {
    const { data, error } = await invokeEdgeFunction<{
      password?: string | null;
    }>("access_entry_password", {
      method: "POST",
      body: {
        action: "get",
        entry_id: Number(entryId),
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to reveal access entry password",
      );
    }
    return data?.password ?? null;
  },
  async setAccessEntryPassword(entryId: Identifier, password: string | null) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "access_entry_password",
      {
        method: "POST",
        body: {
          action: "set",
          entry_id: Number(entryId),
          password,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save access entry password",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to save access entry password");
    }
    return data;
  },
  async logAccessEntryAudit(
    entryId: Identifier,
    auditAction: "viewed" | "copied" | "created" | "updated" | "deleted",
  ) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "access_entry_password",
      {
        method: "POST",
        body: {
          action: "audit",
          entry_id: Number(entryId),
          audit_action: auditAction,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to log credential access",
      );
    }
    return data;
  },
  async getLegacyAccessEntryPasswordCount() {
    const { data, error } = await invokeEdgeFunction<{ count?: number }>(
      "access_entry_password",
      {
        method: "POST",
        body: { action: "legacy_count" },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to check legacy credentials",
      );
    }
    return data?.count ?? 0;
  },
  async migrateLegacyAccessEntryPasswords() {
    const { data, error } = await invokeEdgeFunction<{ migrated?: number }>(
      "access_entry_password",
      {
        method: "POST",
        body: { action: "migrate_legacy" },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to migrate legacy credentials",
      );
    }
    return data?.migrated ?? 0;
  },
  async sendClientSms(params: {
    conversationId?: Identifier;
    contactId?: Identifier;
    dealId?: Identifier | null;
    body: string;
    mediaUrls?: string[];
    isInternalNote?: boolean;
    templateId?: Identifier;
    replyToMessageId?: Identifier | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      message?: import("@/lbs/types").ConversationMessage;
      conversation?: import("@/lbs/types").Conversation;
    }>("send_client_sms", {
      method: "POST",
      body: {
        conversation_id:
          params.conversationId != null
            ? Number(params.conversationId)
            : undefined,
        contact_id:
          params.contactId != null ? Number(params.contactId) : undefined,
        deal_id:
          params.dealId != null && params.dealId !== ""
            ? Number(params.dealId)
            : undefined,
        body: params.body,
        media_urls: params.mediaUrls,
        is_internal_note: params.isInternalNote === true,
        template_id:
          params.templateId != null ? Number(params.templateId) : undefined,
        reply_to_message_id:
          params.replyToMessageId != null
            ? Number(params.replyToMessageId)
            : undefined,
      },
    });
    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const payload = (await response.clone().json()) as {
            message?: string;
          };
          if (payload?.message) {
            throw new Error(payload.message);
          }
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message !== "Failed to send SMS"
          ) {
            throw parseError;
          }
        }
      }
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send SMS",
      );
    }
    return {
      message: data?.message ?? null,
      conversation: data?.conversation ?? null,
    };
  },
  async findClientConversationForContact(contactId: Identifier) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, phone_jsonb")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError || !contact?.id) {
      return null;
    }

    const phoneJsonb = contact.phone_jsonb as
      | PhoneNumberAndType[]
      | null
      | undefined;
    let externalPhone: string | null = null;
    for (const entry of phoneJsonb ?? []) {
      const normalized = normalizeUsPhoneToE164(entry.number ?? "");
      if (normalized) {
        externalPhone = normalized;
        break;
      }
    }

    if (!externalPhone) {
      return null;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("type", "client")
      .eq("external_phone", externalPhone)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? "Failed to load client conversation");
    }

    return (data as import("@/lbs/types").Conversation | null) ?? null;
  },
  async ensureClientConversation(params: {
    contactId: Identifier;
    authorMemberId: Identifier;
    dealId?: Identifier | null;
  }) {
    const authorMemberId = await resolveOrganizationMemberId(
      params.authorMemberId,
    );

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone_jsonb")
      .eq("id", params.contactId)
      .maybeSingle();

    if (contactError || !contact?.id) {
      throw new Error("Contact not found");
    }

    const phoneJsonb = contact.phone_jsonb as
      | PhoneNumberAndType[]
      | null
      | undefined;
    let externalPhone: string | null = null;
    for (const entry of phoneJsonb ?? []) {
      const normalized = normalizeUsPhoneToE164(entry.number ?? "");
      if (normalized) {
        externalPhone = normalized;
        break;
      }
    }

    if (!externalPhone) {
      throw new Error("This contact has no valid phone number");
    }

    const findExisting = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("type", "client")
        .eq("external_phone", externalPhone)
        .maybeSingle();

      if (error) {
        throw new Error(error.message ?? "Failed to load client conversation");
      }

      return data;
    };

    const existing = await findExisting();
    if (existing) {
      return existing as import("@/lbs/types").Conversation;
    }

    const title =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      externalPhone;

    const payload: Record<string, unknown> = {
      type: "client",
      title,
      contact_id: contact.id,
      external_phone: externalPhone,
      created_by_member_id: authorMemberId,
    };

    if (params.dealId != null && params.dealId !== "") {
      const { data: deal } = await supabase
        .from("deals")
        .select("id")
        .eq("id", params.dealId)
        .maybeSingle();
      if (deal?.id) {
        payload.deal_id = deal.id;
      }
    }

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert(payload)
      .select("*")
      .single();

    if (createError) {
      if (createError.code === "23505") {
        const retry = await findExisting();
        if (retry) {
          return retry as import("@/lbs/types").Conversation;
        }
      }
      throw new Error(
        createError.message ?? "Failed to create client conversation",
      );
    }

    return created as import("@/lbs/types").Conversation;
  },
} satisfies DataProvider;

export type CrmDataProvider = typeof dataProviderWithCustomMethods;

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.src;
  }
  return logo?.src ?? "";
};

const taskUpdateContextById = new Map<
  string,
  {
    previous: Record<string, unknown>;
    skipSideEffects: boolean;
  }
>();

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "conversations",
    beforeCreate: async (params) => {
      const data = { ...(params.data as Record<string, unknown>) };
      if (data.type === "client") {
        delete data.deal_id;
      }
      return { ...params, data };
    },
  },
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_subcontractor_entries",
    beforeSave: async (data: any) => {
      if (data.invoice_attachments) {
        data.invoice_attachments = await Promise.all(
          data.invoice_attachments.map((fi: RAFile) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_expenses",
    beforeSave: async (data: any) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi: RAFile) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_change_orders",
    beforeSave: async (data: any) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi: RAFile) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_client_payments",
    beforeSave: async (data: any) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi: RAFile) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "organization_members",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name", "email"], {
        useContactFtsColumns: false,
      })(params);
    },
    beforeSave: async (data: OrganizationMember, _, __) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      if ("email" in data) {
        data.email = normalizeEmailValue(data.email, "email") ?? "";
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
        "primary_contact_first_name",
        "primary_contact_last_name",
      ])(params);
    },
    beforeCreate: async (params) => {
      params.data = normalizeContactData(params.data);
      const createParams = await processCompanyLogo(params);

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      params.data = normalizeContactData(params.data);
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "people",
    beforeCreate: async (params) => {
      params.data.email = normalizeEmailValue(params.data.email, "email");
      params.data.phone = normalizePhoneValue(params.data.phone);
      return params;
    },
    beforeUpdate: async (params) => {
      params.data.email = normalizeEmailValue(params.data.email, "email");
      params.data.phone = normalizePhoneValue(params.data.phone);
      return params;
    },
    beforeGetList: async (params) => {
      return applyFullTextSearch(
        ["first_name", "last_name", "email", "phone"],
        {
          useContactFtsColumns: false,
        },
      )(params);
    },
  },
  {
    resource: "employee_loans",
    beforeCreate: async (params) => {
      return {
        ...params,
        data: normalizeLoanPayload(params.data),
      };
    },
    beforeUpdate: async (params) => {
      return {
        ...params,
        data: normalizeLoanPayload(params.data),
      };
    },
  },
  {
    resource: "deals",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "category",
        "description",
        "notes",
        "project_type",
        "project_address",
        "company_name",
      ])(params);
    },
  },
  {
    resource: "tasks",
    beforeCreate: async (params) => {
      return {
        ...params,
        data: prepareTaskWriteData(params.data as Record<string, unknown>),
      };
    },
    beforeUpdate: async (params) => {
      const merged = {
        ...(params.previousData as Record<string, unknown>),
        ...(params.data as Record<string, unknown>),
      };
      const writeData = prepareTaskWriteData(merged);
      taskUpdateContextById.set(String(params.id), {
        previous: (params.previousData ?? merged) as Record<string, unknown>,
        skipSideEffects: Boolean(
          (
            params.meta as
              | { skipTaskAssignmentSideEffects?: boolean }
              | undefined
          )?.skipTaskAssignmentSideEffects,
        ),
      });
      return {
        ...params,
        data: {
          ...params.data,
          ...writeData,
        },
      };
    },
    afterCreate: async (result, dataProvider) => {
      await persistTaskAssignmentSideEffects(
        dataProvider,
        result.data.id,
        result.data as Record<string, unknown>,
      );
      return result;
    },
    afterUpdate: async (result, dataProvider) => {
      const context = taskUpdateContextById.get(String(result.data.id));
      taskUpdateContextById.delete(String(result.data.id));

      if (context?.skipSideEffects) {
        return result;
      }

      if (
        context?.previous &&
        !taskAssignmentFieldsChanged(
          context.previous,
          result.data as Record<string, unknown>,
        )
      ) {
        return result;
      }

      await persistTaskAssignmentSideEffects(
        dataProvider,
        result.data.id,
        result.data as Record<string, unknown>,
        context?.previous,
      );
      return result;
    },
  },
  {
    resource: "calendar_events",
    beforeCreate: async (params) => ({
      ...params,
      data: prepareCalendarEventWriteData(
        params.data as Record<string, unknown>,
      ),
    }),
    beforeUpdate: async (params) => ({
      ...params,
      data: prepareCalendarEventWriteData({
        ...(params.previousData as Record<string, unknown>),
        ...(params.data as Record<string, unknown>),
      }),
    }),
  },
];

const wrapDataProviderWithQueryInvalidation = (
  provider: CrmDataProvider,
): CrmDataProvider => {
  const invalidate = (resource: string) => {
    void invalidateResourceQueries(resource);
  };

  return {
    ...provider,
    async create(resource, params) {
      const result = await provider.create(resource, params);
      invalidate(resource);
      return result;
    },
    async update(resource, params) {
      const result = await provider.update(resource, params);
      invalidate(resource);
      return result;
    },
    async updateMany(resource, params) {
      const result = await provider.updateMany(resource, params);
      invalidate(resource);
      return result;
    },
    async delete(resource, params) {
      const result = await provider.delete(resource, params);
      invalidate(resource);
      return result;
    },
    async deleteMany(resource, params) {
      const result = await provider.deleteMany(resource, params);
      invalidate(resource);
      return result;
    },
  };
};

export const dataProvider = wrapDataProviderWithQueryInvalidation(
  withLifecycleCallbacks(
    dataProviderWithCustomMethods,
    lifeCycleCallbacks,
  ) as CrmDataProvider,
);

const applyFullTextSearch =
  (columns: string[], options: { useContactFtsColumns?: boolean } = {}) =>
  (params: GetListParams) => {
    if (!params.filter?.q) {
      return params;
    }
    const { useContactFtsColumns = true } = options;
    const { q, ...filter } = params.filter;
    return {
      ...params,
      filter: {
        ...filter,
        "@or": columns.reduce((acc, column) => {
          if (useContactFtsColumns && column === "email")
            return {
              ...acc,
              [`email_fts@ilike`]: q,
            };
          if (useContactFtsColumns && column === "phone")
            return {
              ...acc,
              [`phone_fts@ilike`]: q,
            };
          else
            return {
              ...acc,
              [`${column}@ilike`]: q,
            };
        }, {}),
      },
    };
  };

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Sign URL check if path exists in the bucket
    if (fi.path) {
      const { error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(fi.path, 60);

      if (!error) {
        return fi;
      }
    }
  }

  const dataContent = fi.src
    ? await fetch(fi.src)
        .then((res) => {
          if (res.status !== 200) {
            return null;
          }
          return res.blob();
        })
        .catch(() => null)
    : fi.rawFile;

  if (dataContent == null) {
    // We weren't able to download the file from its src (e.g. user must be signed in on another website to access it)
    // or the file has no content (not probable)
    // In that case, just return it as is: when trying to download it, users should be redirected to the other website
    // and see they need to be signed in. It will then be their responsibility to upload the file back to the note.
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
