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
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";
import { canApprovePayroll } from "@/payroll/permissions";
import { canMutateCrmResource } from "../commons/crmPermissions";
import { normalizeLoanPayload } from "@/loans/helpers";

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

const resolveOrganizationMemberId = async (id: Identifier): Promise<Identifier> => {
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
    .select("id, administrator, roles")
    .eq("user_id", authUserId)
    .single();

  if (!member) return null;

  return {
    id: member.id,
    administrator: member.administrator === true,
    role: member.administrator ? "admin" : (member.roles?.[0] ?? "user"),
    roles: member.roles ?? (member.administrator ? ["admin"] : []),
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
    throw new Error(`Not authorized to ${action} ${resource}`);
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
      try {
        return await baseDataProvider.getOne("companies_summary", params);
      } catch (error: any) {
        if (error?.status === 406) {
          return baseDataProvider.getOne("companies", params);
        }
        throw error;
      }
    }
    if (resource === "contacts") {
      try {
        return await baseDataProvider.getOne("contacts_summary", params);
      } catch (error: any) {
        if (error?.status === 406) {
          return baseDataProvider.getOne("contacts", params);
        }
        throw error;
      }
    }

    return baseDataProvider.getOne(resource, params);
  },

  async signUp({
    email,
    password,
    first_name,
    last_name,
    company_name,
  }: SignUpData) {
    const normalizedEmail = normalizeEmailValue(email, "email");
    const trimmedCompany = String(company_name ?? "").trim();
    if (trimmedCompany.length < 2) {
      throw new Error(
        "Escribe el nombre de tu empresa o equipo (mínimo 2 caracteres).",
      );
    }
    const response = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name,
          last_name,
          company_name: trimmedCompany,
        },
      },
    });

    if (response.error) {
      console.error("signUp.error", response.error);
      const e = response.error;
      const msg = (e.message ?? "").toLowerCase();
      const code = (e as { code?: string }).code;
      if (
        code === "user_already_exists" ||
        code === "email_address_not_available" ||
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("user already")
      ) {
        throw new Error(
          "Este correo ya está registrado. Inicia sesión o usa «Olvidé mi contraseña» en el inicio de sesión.",
        );
      }
      throw new Error(e.message || "No se pudo crear la cuenta.");
    }

    if (!response.data?.user) {
      console.error("signUp.error: no user");
      throw new Error("No se pudo crear la cuenta.");
    }

    // Update the is initialized cache
    getIsInitialized._is_initialized_cache = true;

    return {
      id: response.data.user.id,
      email: normalizedEmail!,
      password,
    };
  },
  async organizationMemberCreate(body: OrganizationMemberFormData) {
    const normalizedBody = {
      ...body,
      email: normalizeEmailValue(body.email, "email")!,
      roles: Array.isArray(body.roles) ? Array.from(new Set(body.roles)) : [],
    };
    const { data, error } = await invokeEdgeFunction<{ data: OrganizationMember }>("users", {
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

    if (!passwordUpdated || error) {
      console.error("update_password.error", error);
      throw new Error("Failed to update password");
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
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    const raw = (data?.config as ConfigurationContextValue) ?? {};
    return withCurrentProductName(raw) as ConfigurationContextValue;
  },
  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.update("configuration", {
      id: 1,
      data: { config },
      previousData: { id: 1 },
    });
    return data.config as ConfigurationContextValue;
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
    const { data, error } = await invokeEdgeFunction<{ url?: string; id?: string }>(
      "stripe-billing",
      {
        method: "POST",
        body: {
          action: "create_checkout",
          org_id: params.orgId,
          return_path: params.returnPath ?? "/sas",
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to start Stripe checkout",
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
        (error as { message?: string }).message ?? "Failed to open billing portal",
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
        (error as { message?: string }).message ?? "Failed to sync seats to Stripe",
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

const lifeCycleCallbacks: ResourceCallbacks[] = [
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
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
) as CrmDataProvider;

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
