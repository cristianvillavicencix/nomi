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
import { supabase } from "./supabase";
import {
  persistContactWithCompany,
  resolveContactCompanyFromPayload,
} from "@/modules/contacts/lbsContactUpsert";
import { shouldClearPrimaryOnCompany } from "@/modules/clients/primaryContactRelink";
import { billingProvider } from "./modules/billingProvider";
import { ticketsProvider } from "./modules/ticketsProvider";
import { proposalsProvider } from "./modules/proposalsProvider";
import { messagingProvider } from "./modules/messagingProvider";
import { webMonitorProvider } from "./modules/webMonitorProvider";
import { formsProvider } from "./modules/formsProvider";
import { orgProvider } from "./modules/orgProvider";
import { dealsProvider } from "./modules/dealsProvider";
import { uploadToBucket } from "./modules/uploadToBucket";
import {
  applyContactListSearch,
  applyFullTextSearch,
} from "./dataProviderSearch";
import {
  assertMutationAllowed,
  getOneFromResourceMaybeSingle,
  fetchContactSummaryById,
  patchContactRow,
  patchTicketRow,
  normalizeMemberEmail,
  patchSingletonConfigurationRow,
  prepareCompanyWriteData,
  prepareContactWriteData,
  processCompanyLogo,
  resolveOrganizationMemberId,
  stripContactFormMetaFields,
} from "./dataProviderWriteHelpers";

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

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  async create(resource: string, params: any) {
    await assertMutationAllowed(resource, "create", params);

    if (resource === "contacts") {
      const data = params.data as Record<string, unknown>;
      const { companyId, companyDraft } = resolveContactCompanyFromPayload(data);

      if (companyDraft || (companyId != null && companyId !== "")) {
        const memberId = await resolveOrganizationMemberId(
          data.organization_member_id as Identifier,
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
          isCreate: true,
        });
        const summary = await fetchContactSummaryById(contact.id);
        return { data: summary ?? contact };
      }
    }

    return baseDataProvider.create(resource, params);
  },
  async update(resource: string, params: any) {
    await assertMutationAllowed(resource, "update", params);

    if (resource === "contacts") {
      const previous = (params.previousData ?? {}) as Record<string, unknown>;
      const merged = {
        ...previous,
        ...(params.data as Record<string, unknown>),
      };
      const { companyId, companyDraft } = resolveContactCompanyFromPayload(merged);
      const data = prepareContactWriteData(merged);
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

          if (mustConfirmMove && merged._primary_move_confirmed !== true) {
            throw new Error(
              "This contact is the primary contact of their current company. Scroll to Company, click “I understand, continue”, then save again.",
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
        const summary = await fetchContactSummaryById(contactId);
        return { data: summary ?? contact };
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

      await patchContactRow({
        contactId,
        orgId: member.org_id,
        data,
      });
      const summary = await fetchContactSummaryById(contactId);
      if (!summary) {
        throw new Error("Contact updated but could not reload profile");
      }
      return { data: summary };
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

    if (resource === "tickets") {
      const previous = (params.previousData ?? {}) as Record<string, unknown>;
      const merged = {
        ...previous,
        ...(params.data as Record<string, unknown>),
      };
      let orgId = merged.org_id as Identifier | undefined;
      if (orgId == null) {
        const existing = await getOneFromResourceMaybeSingle(
          "tickets",
          params.id as Identifier,
        );
        orgId = existing?.org_id as Identifier | undefined;
      }
      if (orgId == null) {
        throw new Error("Ticket organization is missing");
      }
      const row = await patchTicketRow({
        ticketId: params.id as Identifier,
        orgId,
        data: merged,
      });
      return { data: row };
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
    const request = params;

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
  ...ticketsProvider,
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
        data.email = normalizeMemberEmail(data.email);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => applyContactListSearch(params),
    beforeCreate: async (params) => {
      const data = prepareContactWriteData(params.data as Record<string, unknown>);
      stripContactFormMetaFields(data);
      return { ...params, data };
    },
    beforeUpdate: async (params) => ({
      ...params,
      data: prepareContactWriteData({
        ...(params.previousData as Record<string, unknown>),
        ...(params.data as Record<string, unknown>),
      }),
    }),
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
      const createParams = await processCompanyLogo({
        ...params,
        data: prepareCompanyWriteData(params.data as Record<string, unknown>),
      });

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo({
        ...params,
        data: prepareCompanyWriteData({
          ...(params.previousData as Record<string, unknown>),
          ...(params.data as Record<string, unknown>),
        }),
      });
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
