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
  RAFile,
  OrganizationMember,
  EmailAndType,
  PhoneNumberAndType,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getActivityLog } from "../commons/activity";
import {
  persistTaskAssignmentSideEffects,
  prepareTaskWriteData,
  taskAssignmentFieldsChanged,
} from "../../tasks/persistTaskAssignmentSideEffects";
import { invalidateResourceQueries } from "../queryInvalidation";
import { isValidRecordId } from "@/lib/isValidRecordId";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { supabase } from "./supabase";
import { canMutateCrmResource } from "../commons/crmPermissions";
import {
  persistContactWithCompany,
  resolveContactCompanyFromPayload,
} from "@/modules/contacts/lbsContactUpsert";
import { shouldClearPrimaryOnCompany } from "@/modules/clients/primaryContactRelink";
import { normalizePostgrestIlikeQuery } from "../commons/postgrestSearchQuery";
import { billingProvider } from "./modules/billingProvider";
import { proposalsProvider } from "./modules/proposalsProvider";
import { messagingProvider } from "./modules/messagingProvider";
import { webMonitorProvider } from "./modules/webMonitorProvider";
import { formsProvider } from "./modules/formsProvider";
import { orgProvider } from "./modules/orgProvider";
import { dealsProvider } from "./modules/dealsProvider";
import { uploadToBucket } from "./modules/uploadToBucket";

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

    if (resource === "contacts") {
      const { companyDraft } = resolveContactCompanyFromPayload(
        params.data as Record<string, unknown>,
      );
      if (companyDraft) {
        const memberId = await resolveOrganizationMemberId(
          (params.data as Record<string, unknown>)
            .organization_member_id as Identifier,
        );
        const { data: member, error: memberError } = await supabase
          .from("organization_members")
          .select("id, org_id")
          .eq("id", memberId)
          .single();

        if (memberError || !member?.org_id) {
          throw new Error("Organization member not found");
        }

        const contact = await persistContactWithCompany({
          supabase,
          member: member as { id: Identifier; org_id: Identifier },
          contactData: params.data as Record<string, unknown>,
          companyDraft,
          isCreate: true,
        });
        return { data: contact };
      }
    }

    return baseDataProvider.create(resource, params);
  },
  async update(resource: string, params: any) {
    await assertMutationAllowed(resource, "update", params);

    if (resource === "contacts") {
      const data = params.data as Record<string, unknown>;
      const previous = (params.previousData ?? {}) as Record<string, unknown>;
      const { companyId, companyDraft } = resolveContactCompanyFromPayload(data);
      const previousCompanyId = previous.company_id as
        | Identifier
        | null
        | undefined;
      const contactId = params.id as Identifier;
      const companyChanged =
        companyDraft != null ||
        (companyId != null &&
          previousCompanyId != null &&
          String(companyId) !== String(previousCompanyId));

      if (companyChanged && contactId != null) {
        if (previousCompanyId != null) {
          const { data: previousCompany, error: previousCompanyError } =
            await supabase
              .from("companies")
              .select("primary_contact_id")
              .eq("id", previousCompanyId)
              .maybeSingle();

          if (previousCompanyError) {
            throw new Error("Failed to load previous company");
          }

          const mustConfirmMove = shouldClearPrimaryOnCompany(
            previousCompany?.primary_contact_id,
            contactId,
          );

          if (mustConfirmMove && data._primary_move_confirmed !== true) {
            throw new Error(
              "Confirm primary contact move before saving this contact",
            );
          }
        }

        const memberId = await resolveOrganizationMemberId(
          (data.organization_member_id ??
            previous.organization_member_id) as Identifier,
        );
        const { data: member, error: memberError } = await supabase
          .from("organization_members")
          .select("id, org_id")
          .eq("id", memberId)
          .single();

        if (memberError || !member?.org_id) {
          throw new Error("Organization member not found");
        }

        const contact = await persistContactWithCompany({
          supabase,
          member: member as { id: Identifier; org_id: Identifier },
          contactData: data,
          companyId,
          companyDraft,
          contactId,
          previousCompanyId: previousCompanyId ?? null,
          isCreate: false,
        });
        return { data: contact };
      }
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
    await assertMutationAllowed(resource, "update", params);
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

    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", request);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", request);
    }
    if (resource === "monitored_websites") {
      return baseDataProvider.getList("monitored_websites_summary", request);
    }

    return baseDataProvider.getList(resource, request);
  },
  async getOne(resource: string, params: any) {
    if (!isValidRecordId(params?.id)) {
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
      const contactRecord = await getOneFromResourceMaybeSingle(
        "contacts",
        params.id,
      );
      if (contactRecord) {
        return { data: contactRecord };
      }
      throw new Error("Contact not found or access denied");
    }
    if (resource === "monitored_websites") {
      const summaryRecord = await getOneFromResourceMaybeSingle(
        "monitored_websites_summary",
        params.id,
      );
      if (summaryRecord) {
        return { data: summaryRecord };
      }
      return baseDataProvider.getOne("monitored_websites", params);
    }

    return baseDataProvider.getOne(resource, params);
  },

  // Methods that close over baseDataProvider stay in the facade
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

  ...billingProvider,
  ...proposalsProvider,
  ...messagingProvider,
  ...webMonitorProvider,
  ...formsProvider,
  ...orgProvider,
  ...dealsProvider,
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
    beforeGetList: async (params) => applyContactListSearch(params),
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
    beforeGetList: async (params) => applyContactListSearch(params),
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

const CONTACT_SEARCH_COLUMNS = [
  "name",
  "full_name",
  "first_name",
  "last_name",
  "company_name",
  "email",
  "phone",
];

/** Match "Jose Quezada" via first_name + last_name AND; single tokens use @or. */
const applyContactListSearch = (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const trimmed = String(q).trim();
  if (!trimmed) {
    return { ...params, filter };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      ...params,
      filter: {
        ...filter,
        "first_name@ilike": normalizePostgrestIlikeQuery(words[0] ?? ""),
        "last_name@ilike": normalizePostgrestIlikeQuery(words.slice(1).join(" ")),
      },
    };
  }

  return applyFullTextSearch(CONTACT_SEARCH_COLUMNS)(params);
};

const applyFullTextSearch =
  (columns: string[], options: { useContactFtsColumns?: boolean } = {}) =>
  (params: GetListParams) => {
    if (!params.filter?.q) {
      return params;
    }
    const { useContactFtsColumns = true } = options;
    const { q, ...filter } = params.filter;
    const searchTerm = normalizePostgrestIlikeQuery(String(q));
    return {
      ...params,
      filter: {
        ...filter,
        "@or": columns.reduce((acc, column) => {
          if (useContactFtsColumns && column === "email")
            return {
              ...acc,
              [`email_fts@ilike`]: searchTerm,
            };
          if (useContactFtsColumns && column === "phone")
            return {
              ...acc,
              [`phone_fts@ilike`]: searchTerm,
            };
          else
            return {
              ...acc,
              [`${column}@ilike`]: searchTerm,
            };
        }, {}),
      },
    };
  };
