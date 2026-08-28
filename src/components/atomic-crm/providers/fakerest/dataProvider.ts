import {
  withLifecycleCallbacks,
  type CreateParams,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
  type UpdateParams,
} from "ra-core";
import fakeRestDataProvider from "ra-data-fakerest";

import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  EmailAndType,
  PhoneNumberAndType,
  OrganizationMember,
  OrganizationMemberFormData,
  SignUpData,
  Task,
  TaskParticipant,
  TaskTagNotification,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { withCurrentProductName } from "../../root/defaultConfiguration";
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { getActivityLog } from "../commons/activity";
import { normalizePostgrestIlikeQuery } from "../commons/postgrestSearchQuery";
import {
  syncTaskAssignees,
  createTaskTagNotifications,
} from "../../tasks/taskAssignments";
import { syncTaskParticipants } from "../../tasks/taskParticipants";
import { getTaskAssignmentPayload } from "../../tasks/persistTaskAssignmentSideEffects";
import { enrichTasksWithLegacyMentions } from "../../tasks/enrichTasksWithLegacyMentions";
import { normalizeTaskCreateData } from "../../tasks/taskConstants";
import type { GetScopedTasksParams } from "../../tasks/scopedTasks";
import {
  collectMyProjectDealIds,
  filterScopedTasks,
} from "../../tasks/scopedTasksFilter";
import { groupTaskParticipantsByTaskId } from "../../tasks/taskUserCompletion";
import { getCompanyAvatar } from "../commons/getCompanyAvatar";
import { getContactAvatar } from "../commons/getContactAvatar";
import { mergeContacts } from "../commons/mergeContacts";
import { fakeAcceptProposal, fakeSendProposal } from "./proposalFlow";
import { canMutateCrmResource } from "../commons/crmPermissions";
import type { CrmDataProvider } from "../types";
import {
  parseCustomFormSchema,
  validateCustomFormValues,
} from "@/lib/forms-v2/customFormSchemaLegacy";
import { authProvider, USER_STORAGE_KEY } from "./authProvider";
import generateData from "./dataGenerator";
import { enrichCompanySummary } from "@/modules/clients/clientProfile";
import { buildNormalizedDealInsertRecord } from "@/modules/deals/createDeal";
import {
  buildCompanyPayloadFromUpsert,
  buildContactPayloadFromUpsert,
  hasPrimaryContactInput,
  splitClientFullName,
  type LbsClientUpsertInput,
  type LbsClientUpsertResult,
} from "@/modules/clients/lbsClientUpsert";
import {
  contactNeedsCompanyMove,
  shouldClearPrimaryOnCompany,
} from "@/modules/clients/primaryContactRelink";

const baseDataProvider = fakeRestDataProvider(generateData(), true, 300);

const enrichCompaniesWithPrimaryContact = async (companies: Company[]) => {
  const { data: contacts } = await baseDataProvider.getList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  return companies.map((company) => enrichCompanySummary(company, contacts));
};

const enrichContactsWithCompanyMeta = async (contacts: Contact[]) => {
  const { data: companies } = await baseDataProvider.getList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  return contacts.map((contact) => {
    const matchedCompany = companies.find(
      (candidate) => String(candidate.id) === String(contact.company_id),
    );

    return {
      ...contact,
      company_name: matchedCompany?.name ?? contact.company_name,
      is_primary_contact:
        matchedCompany?.primary_contact_id != null &&
        String(matchedCompany.primary_contact_id) === String(contact.id),
    };
  });
};

const TASK_MARKED_AS_DONE = "TASK_MARKED_AS_DONE";
const TASK_MARKED_AS_UNDONE = "TASK_MARKED_AS_UNDONE";
const TASK_DONE_NOT_CHANGED = "TASK_DONE_NOT_CHANGED";
let taskUpdateType = TASK_DONE_NOT_CHANGED;

const processCompanyLogo = async (params: any) => {
  let logo = params.data.logo;

  if (typeof logo !== "object" || logo === null || !logo.src) {
    logo = await getCompanyAvatar(params.data);
  } else if (logo.rawFile instanceof File) {
    const base64Logo = await convertFileToBase64(logo);
    logo = { src: base64Logo, title: logo.title };
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

async function processContactAvatar(
  params: UpdateParams<Contact>,
): Promise<UpdateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact>,
): Promise<CreateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact> | UpdateParams<Contact>,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  if (data.avatar?.src || !data.email_jsonb || !data.email_jsonb.length) {
    return params;
  }
  const avatarUrl = await getContactAvatar(data);

  // Clone the data and modify the clone
  const newData = { ...data, avatar: { src: avatarUrl || undefined } };

  return { ...params, data: newData };
}

async function fetchAndUpdateCompanyData(
  params: UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<UpdateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact> | UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  const newData = { ...data };

  if (!newData.company_id) {
    return params;
  }

  const { data: company } = await dataProvider.getOne("companies", {
    id: newData.company_id,
  });

  if (!company) {
    return params;
  }

  newData.company_name = company.name;
  return { ...params, data: newData };
}

const dataProviderWithCustomMethod: CrmDataProvider = {
  ...baseDataProvider,
  getList: async (resource: string, params: GetListParams) => {
    const result = await baseDataProvider.getList(resource, params);
    if (resource === "companies") {
      return {
        ...result,
        data: await enrichCompaniesWithPrimaryContact(result.data as Company[]),
      };
    }
    if (resource === "contacts") {
      return {
        ...result,
        data: await enrichContactsWithCompanyMeta(result.data as Contact[]),
      };
    }
    if (resource === "tasks") {
      return {
        ...result,
        data: await enrichTasksWithLegacyMentions(
          result.data as Task[],
          baseDataProvider,
        ),
      };
    }
    return result;
  },
  getOne: async (resource, params) => {
    const result = await baseDataProvider.getOne(resource, params);
    if (resource === "companies") {
      const [enriched] = await enrichCompaniesWithPrimaryContact([
        result.data as Company,
      ]);
      return { data: enriched };
    }
    if (resource === "tasks") {
      const [enriched] = await enrichTasksWithLegacyMentions(
        [result.data as Task],
        baseDataProvider,
      );
      return { data: enriched };
    }
    return result;
  },
  create: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "create",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to create ${resource}`);
    }
    return baseDataProvider.create(resource, params);
  },
  update: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "update",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to update ${resource}`);
    }
    return baseDataProvider.update(resource, params);
  },
  updateMany: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "update",
        data: params?.data,
      })
    ) {
      throw new Error(`Not authorized to update ${resource}`);
    }
    return baseDataProvider.updateMany(resource, params);
  },
  delete: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "delete",
        data: params?.previousData,
      })
    ) {
      throw new Error(`Not authorized to delete ${resource}`);
    }
    return baseDataProvider.delete(resource, params);
  },
  deleteMany: async (resource: string, params: any) => {
    const userItem = localStorage.getItem(USER_STORAGE_KEY);
    const identity =
      params?.meta?.identity ?? (userItem ? JSON.parse(userItem) : null);
    if (
      !canMutateCrmResource({
        identity,
        resource,
        action: "delete",
        data: params?.previousData,
      })
    ) {
      throw new Error(`Not authorized to delete ${resource}`);
    }
    return baseDataProvider.deleteMany(resource, params);
  },
  unarchiveDeal: async (deal: Deal) => {
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
        dataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  // We simulate a remote endpoint that is in charge of returning activity log
  getActivityLog: async (companyId?: Identifier) => {
    return getActivityLog(dataProvider, companyId);
  },
  getScopedTasks: async (params: GetScopedTasksParams) => {
    let taggedTaskIds: Identifier[] | null = null;

    if (params.scope === "tagged") {
      const { data: notifications } =
        await baseDataProvider.getList<TaskTagNotification>(
          "task_tag_notifications",
          {
            filter: {
              recipient_organization_member_id: params.organizationMemberId,
              "read_at@is": null,
            },
            pagination: { page: 1, perPage: 500 },
            sort: { field: "created_at", order: "DESC" },
          },
        );
      taggedTaskIds = [
        ...new Set(
          notifications
            .map((entry) => entry.task_id)
            .filter((id) => id != null),
        ),
      ];
      if (taggedTaskIds.length === 0) {
        return { data: [], total: 0 };
      }
    }

    const [{ data: tasks }, { data: participants }] = await Promise.all([
      baseDataProvider.getList<Task>("tasks", {
        pagination: { page: 1, perPage: 5000 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      }),
      baseDataProvider.getList<TaskParticipant>("task_participants", {
        pagination: { page: 1, perPage: 5000 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      }),
    ]);

    const scopedTasks =
      taggedTaskIds == null
        ? tasks
        : tasks.filter((task) =>
            taggedTaskIds!.some((id) => String(id) === String(task.id)),
          );

    return filterScopedTasks(
      scopedTasks,
      params,
      groupTaskParticipantsByTaskId(participants),
    );
  },
  getMyProjectDealIds: async (params: { organizationMemberId: Identifier }) => {
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 5000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    return collectMyProjectDealIds(deals, params.organizationMemberId);
  },
  signUp: async (
    _data: SignUpData,
  ): Promise<{ id: string; email: string; password: string }> => {
    throw new Error(
      "El registro público está deshabilitado. Pide a tu administrador una invitación.",
    );
  },
  organizationMemberCreate: async ({
    ...data
  }: OrganizationMemberFormData): Promise<OrganizationMember> => {
    const response = await dataProvider.create("organization_members", {
      data: {
        ...data,
        email: normalizeEmailValue(data.email, "email")!,
        password: "new_password",
      },
    });

    return response.data;
  },
  organizationMemberUpdate: async (
    id: Identifier,
    data: Partial<Omit<OrganizationMemberFormData, "password">>,
  ): Promise<OrganizationMember> => {
    const { data: previousData } =
      await dataProvider.getOne<OrganizationMember>("organization_members", {
        id,
      });

    if (!previousData) {
      throw new Error("User not found");
    }

    const { data: member } = await dataProvider.update<OrganizationMember>(
      "organization_members",
      {
        id,
        data: {
          ...data,
          email: normalizeEmailValue(data.email, "email"),
        },
        previousData,
      },
    );
    return { ...member, user_id: member.id.toString() };
  },
  isInitialized: async (): Promise<boolean> => {
    const sales = await dataProvider.getList<OrganizationMember>(
      "organization_members",
      {
        filter: {},
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    if (sales.data.length === 0) {
      return false;
    }
    return true;
  },
  updatePassword: async (id: Identifier): Promise<true> => {
    const currentUser = await authProvider.getIdentity?.();
    if (!currentUser) {
      throw new Error("User not found");
    }
    const { data: previousData } =
      await dataProvider.getOne<OrganizationMember>("organization_members", {
        id: currentUser.id,
      });

    if (!previousData) {
      throw new Error("User not found");
    }

    await dataProvider.update("organization_members", {
      id,
      data: {
        password: "demo_newPassword",
      },
      previousData,
    });

    return true;
  },
  mergeContacts: async (sourceId: Identifier, targetId: Identifier) => {
    return mergeContacts(sourceId, targetId, baseDataProvider);
  },
  acceptProposal: async ({ id }: { id: Identifier }) =>
    fakeAcceptProposal(baseDataProvider, id),
  sendProposal: async ({ id }: { id: Identifier }) =>
    fakeSendProposal(baseDataProvider, id),
  issueClientInvoice: async ({
    installmentId,
    proposalId,
    amount,
    dueDate,
    description,
  }: {
    installmentId?: Identifier;
    proposalId?: Identifier;
    amount?: number;
    dueDate?: string;
    description?: string;
  }) => {
    if (installmentId != null) {
      const { data: installment } = await baseDataProvider.getOne(
        "proposal_payment_installments",
        { id: installmentId },
      );
      const year = new Date().getFullYear();
      const { data: invoice } = await baseDataProvider.create(
        "client_invoices",
        {
          data: {
            org_id: 1,
            invoice_number: `INV-${year}-0001`,
            installment_id: installmentId,
            proposal_id: installment.proposal_id,
            issue_date: new Date().toISOString().slice(0, 10),
            due_date: dueDate ?? installment.due_date,
            amount: amount ?? installment.amount,
            currency: "USD",
            description: description ?? installment.label,
            status: installment.status === "paid" ? "paid" : "draft",
          },
        },
      );
      return invoice;
    }

    if (proposalId == null) {
      throw new Error("Missing proposal");
    }

    const { data: proposal } = await baseDataProvider.getOne("proposals", {
      id: proposalId,
    });
    const year = new Date().getFullYear();
    const { data: invoice } = await baseDataProvider.create("client_invoices", {
      data: {
        org_id: 1,
        invoice_number: `INV-${year}-0002`,
        proposal_id: proposalId,
        company_id: proposal.company_id,
        contact_id: proposal.contact_id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate ?? new Date().toISOString().slice(0, 10),
        amount: amount ?? proposal.deposit_amount ?? proposal.amount ?? 0,
        currency: proposal.currency ?? "USD",
        description: description ?? `Invoice for ${proposal.title}`,
        status: "draft",
      },
    });
    return invoice;
  },
  syncProposalInvoices: async ({ proposalId }: { proposalId: Identifier }) => {
    const { data: installments } = await baseDataProvider.getList(
      "proposal_payment_installments",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 500 },
        sort: { field: "installment_number", order: "ASC" },
      },
    );

    const invoices = [];
    for (const installment of installments) {
      const invoice = await dataProviderWithCustomMethod.issueClientInvoice({
        installmentId: installment.id,
      });
      invoices.push(invoice);
    }
    return invoices;
  },
  createStandaloneClientInvoice: async (body) => {
    const year = new Date().getFullYear();
    const { data: invoice } = await baseDataProvider.create("client_invoices", {
      data: {
        org_id: 1,
        invoice_number: `INV-${year}-0099`,
        company_id: body.company_id,
        contact_id: body.contact_id,
        issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: body.due_date,
        subtotal: body.subtotal,
        discount_amount: body.discount_amount ?? 0,
        fee_amount: body.fee_amount ?? 0,
        amount: body.amount,
        terms: body.terms ?? "Net 30",
        description: body.description,
        notes: body.notes ?? null,
        reference: body.reference ?? null,
        recipient_email: body.recipient_email ?? null,
        sales_person_id: body.sales_person_id ?? null,
        save_card_for_future_charges:
          body.save_card_for_future_charges ?? false,
        upfront_percent: body.upfront_percent ?? 100,
        auto_charge_remainder: body.auto_charge_remainder ?? false,
        remainder_schedule: body.remainder_schedule ?? null,
        amount_paid: 0,
        currency: "USD",
        status: "draft",
      },
    });
    await Promise.all(
      body.line_items.map((line, index) =>
        baseDataProvider.create("client_invoice_line_items", {
          data: {
            org_id: 1,
            invoice_id: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit ?? "ea",
            unit_price: line.unit_price,
            line_total: line.quantity * line.unit_price,
            package_id: line.package_id,
            addon_id: line.addon_id,
            sort_order: line.sort_order ?? index,
          },
        }),
      ),
    );
    return invoice;
  },
  updateStandaloneClientInvoice: async (
    invoiceId: Identifier,
    body: Parameters<CrmDataProvider["createStandaloneClientInvoice"]>[0],
  ) => {
    const { data: invoice } = await baseDataProvider.update("client_invoices", {
      id: invoiceId,
      data: {
        company_id: body.company_id,
        contact_id: body.contact_id,
        issue_date: body.issue_date,
        due_date: body.due_date,
        subtotal: body.subtotal,
        discount_amount: body.discount_amount ?? 0,
        fee_amount: body.fee_amount ?? 0,
        amount: body.amount,
        terms: body.terms ?? "Net 30",
        description: body.description,
        notes: body.notes ?? null,
        sales_person_id: body.sales_person_id ?? null,
        save_card_for_future_charges:
          body.save_card_for_future_charges ?? false,
        upfront_percent: body.upfront_percent ?? 100,
        auto_charge_remainder: body.auto_charge_remainder ?? false,
        remainder_schedule: body.remainder_schedule ?? null,
      },
      previousData: { id: invoiceId },
    });
    const existing = await baseDataProvider.getList(
      "client_invoice_line_items",
      {
        filter: { "invoice_id@eq": invoiceId },
        pagination: { page: 1, perPage: 500 },
        sort: { field: "sort_order", order: "ASC" },
      },
    );
    await Promise.all(
      existing.data.map((row) =>
        baseDataProvider.delete("client_invoice_line_items", {
          id: row.id,
          previousData: row,
        }),
      ),
    );
    await Promise.all(
      body.line_items.map((line, index) =>
        baseDataProvider.create("client_invoice_line_items", {
          data: {
            org_id: 1,
            invoice_id: invoiceId,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit ?? "ea",
            unit_price: line.unit_price,
            line_total: line.quantity * line.unit_price,
            package_id: line.package_id,
            addon_id: line.addon_id,
            sort_order: line.sort_order ?? index,
          },
        }),
      ),
    );
    return invoice;
  },
  sendClientInvoice: async ({ invoiceId, smsTo, smsOnly }) => ({
    invoice: { id: invoiceId, status: smsOnly || smsTo ? "sent" : "sent" },
    sent: true,
    email_sent: !smsOnly && !smsTo,
    email_skipped: Boolean(smsOnly || smsTo),
    sms_sent: Boolean(smsTo),
    sms_skipped: !smsTo,
  }),
  scheduleClientInvoice: async ({ invoiceId, to, scheduledSendAt }) => ({
    id: invoiceId,
    recipient_email: to,
    scheduled_send_at: scheduledSendAt,
    status: "draft",
  }),
  manageClientInvoice: async ({ invoiceId, action, voidReason }) => {
    if (action === "delete") {
      return { id: invoiceId, deleted: true };
    }
    if (action === "void") {
      return {
        invoice: {
          id: invoiceId,
          status: "void",
          void_reason: voidReason ?? null,
        },
      };
    }
    return { invoice: { id: invoiceId, status: "sent" } };
  },
  resendClientInvoicePaymentReceipt: async ({ invoiceId }) => ({
    invoice_id: Number(invoiceId),
    payment_intent_id: "pi_demo",
    charged_amount: 0,
    receipt_sent: true,
  }),
  shareClientInvoice: async ({ invoiceId }: { invoiceId: Identifier }) => ({
    token: "demo-invoice-token",
    short_code: "demoiv",
    url: `${window.location.origin}/invoice/demo-invoice-token`,
    short_url: `${window.location.origin}/iv/demoiv`,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    invoice_id: Number(invoiceId),
  }),
  replyTicket: async ({
    ticketId,
    body,
    isInternalNote = false,
    attachments = [],
    nextStatus,
  }) => ({
    message: {
      id: `demo-ticket-message-${Date.now()}`,
      ticket_id: ticketId,
      body: body || "(See attachments)",
      direction: isInternalNote ? "internal" : "outbound",
      attachments,
      created_at: new Date().toISOString(),
    },
    email_sent: !isInternalNote,
    email_skipped: isInternalNote,
    is_internal_note: isInternalNote,
    next_status: nextStatus,
  }),
  mergeTickets: async ({ primaryTicketId, mergeTicketIds }) => ({
    primary_ticket_id: Number(primaryTicketId),
    merged_ticket_ids: mergeTicketIds.map((id) => Number(id)),
  }),

  moveTicketMessages: async ({
    sourceTicketId,
    messageIds,
    targetTicketId,
    createNew,
  }) => ({
    source_ticket_id: Number(sourceTicketId),
    target_ticket_id: createNew
      ? Number(sourceTicketId) + 100000
      : Number(targetTicketId),
    moved_message_ids: messageIds.map((id) => Number(id)),
    created_new: Boolean(createNew),
  }),
  upsertLbsClient: async (
    input: LbsClientUpsertInput,
  ): Promise<LbsClientUpsertResult> => {
    const companyName = input.business.name.trim();
    const { firstName, lastName } = splitClientFullName(input.primary.fullName);
    let created = false;

    const { data: companies } = await baseDataProvider.getList<Company>(
      "companies",
      {
        pagination: { page: 1, perPage: 10000 },
        sort: { field: "id", order: "ASC" },
      },
    );

    const existingCompany = input.companyId
      ? companies.find(
          (company) => String(company.id) === String(input.companyId),
        )
      : companies.find(
          (company) => company.name.toLowerCase() === companyName.toLowerCase(),
        );

    if (input.companyId && !existingCompany) {
      throw new Error("Client not found");
    }

    const companyPayload = buildCompanyPayloadFromUpsert(
      input,
      existingCompany?.context_links,
    );

    let companyId: Identifier;
    if (existingCompany) {
      const { data: updatedCompany } = await baseDataProvider.update<Company>(
        "companies",
        {
          id: existingCompany.id,
          data: companyPayload,
          previousData: existingCompany,
        },
      );
      companyId = updatedCompany.id;
    } else {
      const { data: newCompany } = await baseDataProvider.create<Company>(
        "companies",
        {
          data: {
            sector: "information-technology",
            ...companyPayload,
          },
        },
      );
      companyId = newCompany.id;
      created = true;
    }

    const { data: contacts } = await baseDataProvider.getList<Contact>(
      "contacts",
      {
        pagination: { page: 1, perPage: 10000 },
        sort: { field: "id", order: "ASC" },
      },
    );

    const companyContacts = contacts.filter(
      (candidate) => String(candidate.company_id) === String(companyId),
    );

    const primaryEmail = input.primary.emails?.[0]?.value?.trim().toLowerCase();
    let contact: Contact | undefined;

    if (hasPrimaryContactInput(input)) {
      if (input.primaryContactId) {
        const matched = contacts.find(
          (candidate) =>
            String(candidate.id) === String(input.primaryContactId),
        );
        if (matched) {
          contact = matched;
          if (
            contactNeedsCompanyMove(contact.company_id, companyId) ||
            contact.company_id == null
          ) {
            if (contactNeedsCompanyMove(contact.company_id, companyId)) {
              const oldCompany = companies.find(
                (entry) =>
                  String(entry.id) === String(contact!.company_id) &&
                  shouldClearPrimaryOnCompany(
                    entry.primary_contact_id,
                    contact!.id,
                  ),
              );
              if (oldCompany) {
                await baseDataProvider.update("companies", {
                  id: oldCompany.id,
                  data: { primary_contact_id: null },
                  previousData: oldCompany,
                });
              }
            }
            const { data: movedContact } =
              await baseDataProvider.update<Contact>("contacts", {
                id: contact.id,
                data: {
                  company_id: companyId,
                  last_seen: new Date().toISOString(),
                },
                previousData: contact,
              });
            contact = movedContact;
          }
        }
      }

      if (!contact) {
        contact =
          (primaryEmail
            ? companyContacts.find((candidate) =>
                candidate.email_jsonb?.some(
                  (entry) => entry.email?.trim().toLowerCase() === primaryEmail,
                ),
              )
            : undefined) ??
          companyContacts.find(
            (candidate) =>
              candidate.first_name?.toLowerCase() === firstName.toLowerCase() &&
              candidate.last_name?.toLowerCase() ===
                (lastName || firstName).toLowerCase(),
          );
      }

      if (contact && input.linkPrimaryContactOnly) {
        // Link only — contact body is edited in the contact profile.
      } else if (contact) {
        const { data: updatedContact } = await baseDataProvider.update<Contact>(
          "contacts",
          {
            id: contact.id,
            data: buildContactPayloadFromUpsert(input, companyId, "update"),
            previousData: contact,
          },
        );
        contact = updatedContact;
      } else {
        const { data: newContact } = await baseDataProvider.create<Contact>(
          "contacts",
          {
            data: buildContactPayloadFromUpsert(input, companyId, "create"),
          },
        );
        contact = newContact;
      }
    }

    await baseDataProvider.update("companies", {
      id: companyId,
      data: { primary_contact_id: contact?.id ?? null },
      previousData: existingCompany ?? { id: companyId },
    });

    return {
      company_id: companyId,
      contact_id: contact?.id ?? null,
      created,
    };
  },
  createDeal: async (
    payload: import("@/modules/deals/createDeal").CreateDealPayload,
  ) => {
    const { data: company } = await baseDataProvider.getOne<Company>(
      "companies",
      { id: payload.companyId },
    );
    if (!company) {
      throw new Error("Company not found");
    }

    const { data } = await baseDataProvider.create<Deal>("deals", {
      data: buildNormalizedDealInsertRecord({
        ...payload,
        orgId: payload.orgId ?? company.org_id ?? null,
      }) as Deal,
    });

    return { data };
  },
  convertLeadToClient: async ({
    contactId,
    companyName,
  }: {
    contactId: Identifier;
    companyName: string;
  }) => {
    const trimmedName = companyName.trim();
    const { data: contact } = await baseDataProvider.getOne<Contact>(
      "contacts",
      { id: contactId },
    );
    if (!contact) {
      throw new Error("Lead not found");
    }

    const { data: companies } = await baseDataProvider.getList<Company>(
      "companies",
      {
        pagination: { page: 1, perPage: 10000 },
        sort: { field: "id", order: "ASC" },
      },
    );

    let company =
      (contact.company_id
        ? companies.find(
            (candidate) => String(candidate.id) === String(contact.company_id),
          )
        : undefined) ??
      companies.find(
        (candidate) =>
          candidate.name.toLowerCase() === trimmedName.toLowerCase(),
      );

    if (!company) {
      const { data: createdCompany } = await baseDataProvider.create<Company>(
        "companies",
        {
          data: {
            name: trimmedName,
            organization_member_id: contact.organization_member_id,
            sector: "information-technology",
          },
        },
      );
      company = createdCompany;
    }

    await baseDataProvider.update("contacts", {
      id: contactId,
      data: {
        company_id: company.id,
        status: "client",
      },
      previousData: contact,
    });

    if (!company.primary_contact_id) {
      await baseDataProvider.update("companies", {
        id: company.id,
        data: { primary_contact_id: contactId },
        previousData: company,
      });
    }

    return { company_id: company.id, contact_id: contactId };
  },
  submitPublicForm: async (payload: {
    slug: string;
    companyId?: Identifier | null;
    contactId?: Identifier | null;
    dealId?: Identifier | null;
    data: Record<string, unknown>;
  }) => {
    const { data: forms } = await baseDataProvider.getList<
      import("@/modules/types").Form
    >("forms", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    const form = forms.find((entry) => entry.slug === payload.slug);
    if (!form || form.active === false) {
      throw new Error("Form not found");
    }

    if (payload.slug !== "website-intake") {
      const schema = parseCustomFormSchema(form.schema);
      const data = Object.fromEntries(
        schema.fields.map((field) => [
          field.key,
          String(payload.data[field.key] ?? "").trim(),
        ]),
      ) as Record<string, string>;
      const validationError = validateCustomFormValues(schema, data);
      if (validationError) {
        throw new Error(validationError);
      }

      const companyId = payload.companyId ? Number(payload.companyId) : null;
      const contactId = payload.contactId ? Number(payload.contactId) : null;
      const dealId = payload.dealId ? Number(payload.dealId) : null;

      await baseDataProvider.create("form_submissions", {
        data: {
          form_id: form.id,
          company_id: companyId,
          contact_id: contactId,
          deal_id: dealId,
          data,
        },
      });

      return {
        company_id: companyId,
        contact_id: contactId,
        deal_id: dealId,
      };
    }

    const companyId = payload.companyId ? Number(payload.companyId) : null;
    const contactId = payload.contactId ? Number(payload.contactId) : null;
    if (!companyId || !contactId) {
      throw new Error(
        "This form link must include a valid client and contact.",
      );
    }

    const { data: company } = await baseDataProvider.getOne<Company>(
      "companies",
      {
        id: companyId,
      },
    );

    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "id", order: "ASC" },
    });

    const linkedDeal = payload.dealId
      ? deals.find((deal) => String(deal.id) === String(payload.dealId))
      : undefined;

    const existing =
      linkedDeal ??
      deals.find(
        (deal) =>
          String(deal.company_id) === String(companyId) &&
          deal.category === "website",
      );

    let dealId: Identifier;
    let created = false;

    if (existing) {
      const { data: updated } = await baseDataProvider.update<Deal>("deals", {
        id: existing.id,
        data: {
          contact_id: contactId,
          contact_ids: [contactId],
          website_brief: payload.data,
          description: String(
            payload.data.client_notes ?? payload.data.notes ?? "",
          ),
        },
        previousData: existing,
      });
      dealId = updated.id;
    } else {
      const { data: createdDeal } = await baseDataProvider.create<Deal>(
        "deals",
        {
          data: {
            name: `${company.name} Website`,
            company_id: companyId,
            contact_id: contactId,
            contact_ids: [contactId],
            stage: "lead",
            amount: 0,
            category: "website",
            website_brief: payload.data,
            description: String(
              payload.data.client_notes ?? payload.data.notes ?? "",
            ),
            index: 0,
            pipeline_id: "default",
          },
        },
      );
      dealId = createdDeal.id;
      created = true;
    }

    await baseDataProvider.create("form_submissions", {
      data: {
        form_id: form.id,
        company_id: companyId,
        contact_id: contactId,
        deal_id: dealId,
        data: payload.data,
      },
    });

    return {
      company_id: companyId,
      contact_id: contactId,
      deal_id: dealId,
      created,
    };
  },
  getPublicForm: async (payload: { slug: string }) => {
    const { data: forms } = await baseDataProvider.getList<
      import("@/modules/types").Form
    >("forms", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    const form = forms.find(
      (entry) => entry.slug === payload.slug && entry.active !== false,
    );
    if (!form) {
      throw new Error("Form not found");
    }

    return {
      name: form.name,
      description: form.description,
      slug: form.slug,
      schema: parseCustomFormSchema(form.schema),
    };
  },
  getPublicDealBrief: async (payload: {
    dealId: Identifier;
    companyId: Identifier;
    contactId: Identifier;
  }) => {
    const { data: deal } = await baseDataProvider.getOne<Deal>("deals", {
      id: payload.dealId,
    });

    if (
      String(deal.company_id) !== String(payload.companyId) ||
      (String(deal.contact_id) !== String(payload.contactId) &&
        !deal.contact_ids?.map(String).includes(String(payload.contactId)))
    ) {
      throw new Error("Project not found");
    }

    return {
      project_type: deal.project_type,
      expected_end_date: deal.expected_end_date,
      website_brief: (deal.website_brief ?? {}) as Record<
        string,
        string | null
      >,
    };
  },
  getGithubRepoStatus: async (payload: { dealId: Identifier }) => {
    const { data: deal } = await baseDataProvider.getOne<Deal>("deals", {
      id: payload.dealId,
    });

    if (!deal.github_repo?.trim()) {
      throw new Error("Project has no GitHub repository linked");
    }

    const slug = deal.github_repo.trim();
    const now = new Date().toISOString();

    return {
      slug,
      repo_url: `https://github.com/${slug}`,
      default_branch: "main",
      last_commit: {
        sha: "abc1234567890abcdef1234567890abcdef12345678",
        short_sha: "abc1234",
        message: "Update homepage hero section",
        author: "LBS Team",
        date: now,
        url: `https://github.com/${slug}/commit/abc1234`,
      },
      latest_run: {
        status: "completed",
        conclusion: "success",
        workflow_name: "Deploy",
        updated_at: now,
        url: `https://github.com/${slug}/actions`,
      },
      github_token_configured: true,
      languages: ["TypeScript", "CSS", "HTML"],
    };
  },
  submitProjectResources: async (payload: {
    dealId: Identifier;
    companyId?: Identifier | null;
    contactId?: Identifier | null;
    items: Array<{
      category: string;
      label?: string;
      name: string;
      content: string;
      content_type?: string;
    }>;
  }) => {
    const dealId = Number(payload.dealId);
    if (!Number.isFinite(dealId)) {
      throw new Error("Missing deal_id");
    }

    let count = 0;
    for (const item of payload.items) {
      await baseDataProvider.create("deal_resources", {
        data: {
          deal_id: dealId,
          category: item.category,
          label: item.label?.trim() || null,
          file: {
            title: item.name,
            type: item.content_type || "application/octet-stream",
            path: `project-resources/${dealId}/${count + 1}-${item.name}`,
            src: `https://placehold.co/600x400?text=${encodeURIComponent(item.name)}`,
          },
          source: "client",
        },
      });
      count += 1;
    }

    return { deal_id: dealId, count };
  },
  getConfiguration: async (): Promise<ConfigurationContextValue> => {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    const raw = (data?.config as ConfigurationContextValue) ?? {};
    return withCurrentProductName(raw) as ConfigurationContextValue;
  },
  updateConfiguration: async (
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> => {
    const { data: prev } = await baseDataProvider.getOne("configuration", {
      id: 1,
    });
    await baseDataProvider.update("configuration", {
      id: 1,
      data: { config },
      previousData: prev,
    });
    return config;
  },
  syncOrganizationPipelineStages: async () => undefined,
  syncOrganizationBookingTimezone: async () => undefined,
  stripeCreateCheckoutSession: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  stripeBillingPortal: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  stripeSyncSeats: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  stripeAddOneSeat: async () => {
    throw new Error("Stripe billing is not available in demo mode");
  },
  createClientSubscription: async (body) => {
    const year = new Date().getFullYear();
    const { data: subscription } = await baseDataProvider.create(
      "client_subscriptions",
      {
        data: {
          org_id: 1,
          company_id: body.company_id ?? null,
          contact_id: body.contact_id ?? null,
          deal_id: body.deal_id ?? null,
          reference_number: body.reference_number ?? null,
          subscription_number: `SUB-${year}-0001`,
          name: body.name,
          amount: body.amount,
          currency: body.currency ?? "USD",
          billing_interval: body.billing_interval,
          line_items: body.line_items ?? [],
          starts_at: body.starts_at ?? null,
          ends_at: body.ends_at ?? null,
          status:
            body.payment_mode === "saved_card" ||
            body.payment_mode === "staff_card"
              ? "active"
              : "pending_setup",
          activated_at:
            body.payment_mode === "saved_card" ||
            body.payment_mode === "staff_card"
              ? new Date().toISOString()
              : null,
        },
      },
    );
    return {
      subscription,
      checkout_url: "https://checkout.stripe.com/demo",
      used_saved_card: body.payment_mode === "saved_card",
      used_staff_card: body.payment_mode === "staff_card",
      email_sent: body.send_email !== false,
      sms_sent: body.send_sms !== false,
    };
  },
  prepareClientSubscriptionPayment: async () => ({
    client_secret: "seti_demo_secret",
    publishable_key: "pk_demo",
    stripe_customer_id: "cus_demo",
  }),
  manageClientSubscription: async ({
    subscriptionId,
    action,
    name,
    description,
    amount,
    billing_interval,
    ends_at,
    reference_number,
    deal_id,
    line_items,
    payment_mode,
    email_to,
    send_email,
    send_sms,
  }) => {
    if (action === "update") {
      const { data: subscription } = await baseDataProvider.update(
        "client_subscriptions",
        {
          id: subscriptionId,
          data: {
            ...(name ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(amount != null ? { amount } : {}),
            ...(billing_interval ? { billing_interval } : {}),
            ...(ends_at !== undefined ? { ends_at } : {}),
            ...(reference_number !== undefined ? { reference_number } : {}),
            ...(deal_id !== undefined ? { deal_id } : {}),
            ...(line_items !== undefined ? { line_items } : {}),
          },
          previousData: { id: subscriptionId },
        },
      );
      return { subscription, setup_link_stale: false };
    }

    if (action === "apply_payment") {
      const { data: subscription } = await baseDataProvider.getOne(
        "client_subscriptions",
        { id: subscriptionId },
      );
      const nextStatus =
        payment_mode === "saved_card" || payment_mode === "staff_card"
          ? "active"
          : "pending_setup";
      const { data: updated } = await baseDataProvider.update(
        "client_subscriptions",
        {
          id: subscriptionId,
          data: {
            status: nextStatus,
            setup_checkout_url:
              payment_mode === "request_setup"
                ? "https://checkout.stripe.com/demo"
                : subscription.setup_checkout_url,
          },
          previousData: subscription,
        },
      );
      return {
        subscription: updated,
        checkout_url:
          payment_mode === "request_setup"
            ? "https://checkout.stripe.com/demo"
            : null,
        used_saved_card: payment_mode === "saved_card",
        used_staff_card: payment_mode === "staff_card",
        email_sent: send_email !== false && Boolean(email_to),
        sms_sent: send_sms === true,
      };
    }

    const status =
      action === "reactivate"
        ? "active"
        : action === "undo_cancel"
          ? "active"
          : action === "cancel_now" || action === "cancel_at_period_end"
            ? "canceled"
            : action === "pause"
              ? "paused"
              : action === "resume"
                ? "active"
                : "pending_setup";
    const { data: subscription } = await baseDataProvider.update(
      "client_subscriptions",
      {
        id: subscriptionId,
        data: {
          status,
          ...(action === "reactivate"
            ? {
                canceled_at: null,
                cancel_at_period_end: false,
                activated_at: new Date().toISOString(),
              }
            : {}),
          ...(action === "cancel_now"
            ? { canceled_at: new Date().toISOString(), cancel_at_period_end: false }
            : {}),
          ...(action === "undo_cancel" ? { cancel_at_period_end: false } : {}),
        },
        previousData: { id: subscriptionId },
      },
    );
    return {
      subscription,
      checkout_url:
        action === "send_setup" ? "https://checkout.stripe.com/demo" : null,
    };
  },
  getPlatformAuthUsers: async () => ({
    users: [],
    total: 0,
  }),
  ensureCalendarFeedToken: async () => ({
    token: "demo-feed-token",
    feed_url:
      "https://example.supabase.co/functions/v1/calendar_feed?token=demo-feed-token",
    webcal_url:
      "webcal://example.supabase.co/functions/v1/calendar_feed?token=demo-feed-token",
  }),
  getVoiceToken: async () => ({
    provider: "twilio" as const,
    token: "demo-voice-token",
    identity: "member-1-1",
    caller_id: null,
  }),
  lookupContactByPhone: async () => null,
  getMessagingSettings: async () => ({
    org_id: 1,
    messaging_provider: "twilio" as const,
    twilio_account_sid: null,
    twilio_phone_number: null,
    sms_enabled: false,
    has_auth_token: false,
    webhook_url: null,
    has_telnyx_api_key: false,
    telnyx_phone_number: null,
    telnyx_messaging_profile_id: null,
    telnyx_webhook_url: null,
    telnyx_status_webhook_url: null,
    telnyx_sip_connection_id: null,
    telnyx_telephony_credential_id: null,
    telnyx_sip_username: null,
    has_telnyx_sip_password: false,
    telnyx_caller_id: null,
    voice_enabled: false,
    voice_twiml_app_sid: null,
    voice_api_key_sid: null,
    has_voice_api_key_secret: false,
    voice_caller_id: null,
    voice_recording_default: false,
    voice_twiml_url: null,
    voice_status_webhook_url: null,
  }),
  ensureProjectConversation: async ({ dealId }) => dealId,
  ensureTeamDmConversation: async ({ otherMemberId }) => otherMemberId,
  updateMessagingSettings: async (params) => ({
    org_id: 1,
    twilio_account_sid: params.twilio_account_sid ?? null,
    twilio_phone_number: params.twilio_phone_number ?? null,
    sms_enabled: params.sms_enabled === true,
    has_auth_token: Boolean(params.twilio_auth_token?.trim()),
    webhook_url: null,
    business_hours: params.business_hours ?? null,
    out_of_hours_message: params.out_of_hours_message ?? null,
    auto_acknowledge_enabled: params.auto_acknowledge_enabled ?? false,
    auto_acknowledge_message: params.auto_acknowledge_message ?? null,
  }),
  getEmailDeliverySettings: async () => ({
    configured: false,
    provider: null,
    from_email: null,
    general_from_email: null,
    billing_from_email: null,
    general_email_enabled: true,
    billing_email_enabled: true,
    reply_to: null,
    billing_from: null,
    org_name: "Demo",
  }),
  updateEmailDeliverySettings: async (params) => ({
    configured: false,
    provider: null,
    from_email: null,
    general_from_email: params.general_from_email ?? params.reply_to ?? null,
    billing_from_email: params.billing_from_email ?? null,
    general_email_enabled: params.general_email_enabled ?? true,
    billing_email_enabled: params.billing_email_enabled ?? true,
    reply_to: params.general_from_email ?? params.reply_to ?? null,
    billing_from: params.billing_from_email ?? null,
    org_name: "Demo",
    ticket_inbound: params.ticket_inbox_email
      ? {
          support_email: params.ticket_inbox_email,
          is_active: params.ticket_inbox_enabled ?? true,
          sendgrid_hostname: null,
          sendgrid_forward_address: null,
          hostinger_forward_to: null,
          mx_record: "mx.sendgrid.net",
          webhook_url: null,
          webhook_configured: false,
        }
      : null,
  }),
  sendTestTransactionalEmail: async () => ({ ok: true }),
  getTicketWorkspaceSettings: async () => ({
    workspace: {
      ...(
        await import("@/modules/settings/tickets/ticketWorkspaceSettings")
      ).DEFAULT_TICKET_WORKSPACE_SETTINGS,
    },
    inboxes: [],
    health: {
      webhook_configured: false,
      outbound_configured: false,
      last_inbound_at: null,
      last_inbound_inbox_email: null,
    },
  }),
  updateTicketWorkspaceSettings: async (params) => {
    const base = await (
      await import("@/modules/settings/tickets/ticketWorkspaceSettings")
    ).DEFAULT_TICKET_WORKSPACE_SETTINGS;
    return {
      workspace: { ...base, ...(params.workspace ?? {}) },
      inboxes: [],
      health: {
        webhook_configured: false,
        outbound_configured: true,
        last_inbound_at: null,
        last_inbound_inbox_email: null,
      },
    };
  },
  sendTestTicketOutboundEmail: async () => ({ ok: true }),
  sendTicketCsatEmail: async () => ({ ok: true }),
  dismissTicketInboundFailure: async () => ({ ok: true }),
  retryTicketInboundFailure: async () => ({
    ok: true,
    ticket_id: 1,
  }),
  importTicketEmail: async () => ({
    ok: true,
    ticket_id: 1,
    skipped_attachments: 0,
  }),
  getStripeClientSettings: async () => ({
    org_id: 1,
    stripe_credential_mode: "server" as const,
    credential_mode_label: "Supabase server",
    invoice_payments_enabled: true,
    payment_link_payments_enabled: true,
    proposal_payments_enabled: false,
    save_cards_default: true,
    configured: false,
    payment_status: "not_configured" as const,
    payment_status_label: "Not set up",
    credential_source: "none" as const,
    connection_label: "Not configured",
    server_keys_configured: false,
    settings_keys_configured: false,
    stripe_publishable_key: null,
    publishable_key_preview: null,
    publishable_key_configured: false,
    secret_key_configured: false,
    webhook_secret_configured: false,
    has_secret_key: false,
    has_webhook_secret: false,
    webhook_url: null,
  }),
  updateStripeClientSettings: async (params) => ({
    org_id: 1,
    stripe_credential_mode: params.stripe_credential_mode ?? "server",
    credential_mode_label:
      params.stripe_credential_mode === "settings"
        ? "Manual (Settings)"
        : "Supabase server",
    invoice_payments_enabled: params.invoice_payments_enabled ?? true,
    payment_link_payments_enabled: params.invoice_payments_enabled ?? true,
    proposal_payments_enabled: params.proposal_payments_enabled ?? false,
    save_cards_default: params.save_cards_default ?? true,
    configured: Boolean(params.stripe_publishable_key || params.stripe_secret_key),
    payment_status: (params.invoice_payments_enabled ||
    params.payment_link_payments_enabled ||
    params.proposal_payments_enabled
      ? "live"
      : params.stripe_secret_key
        ? "paused"
        : "not_configured") as const,
    payment_status_label:
      params.invoice_payments_enabled ||
      params.payment_link_payments_enabled ||
      params.proposal_payments_enabled
        ? "Card payments on"
        : params.stripe_secret_key
          ? "Card payments paused"
          : "Not set up",
    credential_source: "database" as const,
    connection_label: "Connected (Settings)",
    server_keys_configured: false,
    settings_keys_configured: Boolean(params.stripe_secret_key),
    stripe_publishable_key: params.stripe_publishable_key ?? null,
    publishable_key_preview: params.stripe_publishable_key
      ? `${params.stripe_publishable_key.slice(0, 8)}…${params.stripe_publishable_key.slice(-4)}`
      : null,
    publishable_key_configured: Boolean(params.stripe_publishable_key),
    secret_key_configured: Boolean(params.stripe_secret_key),
    webhook_secret_configured: Boolean(params.stripe_webhook_secret),
    has_secret_key: Boolean(params.stripe_secret_key),
    has_webhook_secret: Boolean(params.stripe_webhook_secret),
    webhook_url: null,
  }),
  testStripeClientSettings: async () => ({ ok: true }),
  getHostingerSettings: async () => ({
    org_id: 1,
    has_api_token: false,
    has_mail_api_token: false,
    weekly_sync_enabled: true,
    referral_code: null,
    referral_link_template: null,
    last_synced_at: null,
    last_sync_error: null,
  }),
  updateHostingerSettings: async () => ({
    org_id: 1,
    has_api_token: true,
    has_mail_api_token: true,
    weekly_sync_enabled: true,
    referral_code: "DEMO123",
    referral_link_template: null,
    last_synced_at: null,
    last_sync_error: null,
  }),
  testHostingerConnection: async () => ({ ok: true }),
  testHostingerMailConnection: async () => ({ ok: true }),
  hostingerSync: async () => ({ ok: true, synced: 0 }),
  hostingerCheckAvailability: async ({ domain }) => ({
    ok: true,
    referral_code: "DEMO123",
    referral_link_template: null,
    results: [
      {
        domain: `${domain}.com`,
        is_available: true,
        is_alternative: false,
        tld: "com",
        first_period_price_cents: 1,
        renewal_price_cents: 1999,
        currency: "USD",
        period_label: "3 years",
        is_promotional: true,
      },
      {
        domain: `${domain}.net`,
        is_available: false,
        is_alternative: false,
        tld: "net",
        first_period_price_cents: 1299,
        renewal_price_cents: 1599,
        currency: "USD",
        period_label: "1 year",
      },
    ],
  }),
  hostingerGetDomainDetails: async ({ domain }) => ({
    ok: true,
    domain,
    cached: null,
    details: {
      domain,
      status: "active",
      type: "domain",
      is_locked: true,
      is_privacy_protected: false,
      name_servers: { ns1: "ns1.dns-parking.com", ns2: "ns2.dns-parking.com" },
    },
    dns_records: [
      {
        type: "A",
        name: "@",
        ttl: 14400,
        records: [{ content: "192.0.2.1" }],
      },
    ],
    dns_error: null,
    has_mail_api_token: true,
    mailboxes: [
      { resource_id: "mb-1", address: `info@${domain}` },
      { resource_id: "mb-2", address: `contact@${domain}` },
    ],
    mail_error: null,
  }),
  sendTestSms: async () => ({ ok: true }),
  sendMeetingLink: async ({ to, meetingUrl }) => ({
    sent: true,
    to: to ?? "client@example.com",
    meeting_url: meetingUrl,
  }),
  notifyMeetingScheduled: async () => ({
    ok: true,
    calendar_url: "https://example.com/c/demo",
    host_sms: { sent: true },
    client_email: { sent: true },
    client_sms: { sent: true },
  }),
  notifyMeetingRescheduled: async () => ({
    ok: true,
    calendar_url: "https://example.com/c/demo",
    host_sms: { sent: true },
    client_email: { sent: true },
    client_sms: { sent: true },
  }),
  syncCalendarEventBooking: async () => ({
    ok: true,
    has_booking: false,
  }),
  notifyTaskRescheduled: async () => ({
    ok: true,
    recipients: 1,
    sent: 1,
    skipped: 0,
    reasons: [],
  }),
  sendClientSms: async ({
    conversationId,
    contactId,
    dealId,
    body,
    mediaUrls,
    externalPhone,
    resendMessageId,
  }) => {
    if (resendMessageId != null) {
      const { data: existing } = await baseDataProvider.getOne<
        import("@/modules/types").ConversationMessage
      >("conversation_messages", { id: resendMessageId });
      const { data: conversation } = await baseDataProvider.getOne<
        import("@/modules/types").Conversation
      >("conversations", { id: existing.conversation_id });
      const { data: message } = await baseDataProvider.update<
        import("@/modules/types").ConversationMessage
      >("conversation_messages", {
        id: resendMessageId,
        data: {
          sms_delivery_status: "queued",
          sms_error_code: null,
          external_id: `SM_FAKE_${Date.now()}`,
        },
        previousData: existing,
      });
      return { message: message, conversation };
    }

    let conversation: import("@/modules/types").Conversation;
    if (conversationId) {
      const { data } = await baseDataProvider.getOne<
        import("@/modules/types").Conversation
      >("conversations", { id: conversationId });
      conversation = data;
    } else if (contactId) {
      conversation =
        await dataProviderWithCustomMethod.ensureClientConversation({
          contactId,
          authorMemberId: 1,
          dealId,
          externalPhone,
        });
    } else if (externalPhone) {
      const resolvedPhone = normalizeUsPhoneToE164(externalPhone);
      if (!resolvedPhone) {
        throw new Error("A valid US phone number is required");
      }
      const { data: existing = [] } = await baseDataProvider.getList<
        import("@/modules/types").Conversation
      >("conversations", {
        filter: {
          "type@eq": "client",
          "external_phone@eq": resolvedPhone,
        },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      conversation =
        existing[0] ??
        (
          await baseDataProvider.create<import("@/modules/types").Conversation>(
            "conversations",
            {
              data: {
                type: "client",
                title: resolvedPhone,
                external_phone: resolvedPhone,
                contact_id: null,
                deal_id: dealId ?? null,
                created_by_member_id: 1,
              },
            },
          )
        ).data;
    } else {
      throw new Error(
        "conversation_id, contact_id, or external_phone is required",
      );
    }

    const message = await baseDataProvider.create<
      import("@/modules/types").ConversationMessage
    >("conversation_messages", {
      data: {
        conversation_id: conversation.id,
        body: body?.trim() || (mediaUrls?.length ? "Photo" : ""),
        channel: "sms",
        direction: "outbound",
        author_member_id: conversation.created_by_member_id ?? null,
        media_url: mediaUrls?.[0] ?? null,
        media_urls: mediaUrls ?? [],
      },
    });
    return { message: message.data, conversation };
  },
  findClientConversationForContact: async (contactId, externalPhone) => {
    const { data: contact } = await baseDataProvider.getOne<
      import("@/modules/types").Contact
    >("contacts", { id: contactId });
    const phone =
      externalPhone != null && externalPhone !== ""
        ? normalizeUsPhoneToE164(externalPhone)
        : normalizeUsPhoneToE164(
            contact.phone_jsonb?.map((entry) => entry.number).find(Boolean) ??
              "",
          );
    const { data: existing = [] } = await baseDataProvider.getList<
      import("@/modules/types").Conversation
    >("conversations", {
      filter: phone
        ? { "type@eq": "client", "external_phone@eq": phone }
        : { "type@eq": "client", "contact_id@eq": contactId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    return existing[0] ?? null;
  },
  findClientConversationByPhone: async (externalPhone) => {
    const phone = normalizeUsPhoneToE164(externalPhone);
    if (!phone) return null;
    const { data: existing = [] } = await baseDataProvider.getList<
      import("@/modules/types").Conversation
    >("conversations", {
      filter: { "type@eq": "client", "external_phone@eq": phone },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    return existing[0] ?? null;
  },
  ensureClientConversation: async ({
    contactId,
    authorMemberId,
    dealId,
    externalPhone,
  }) => {
    const { data: contact } = await baseDataProvider.getOne<
      import("@/modules/types").Contact
    >("contacts", { id: contactId });
    const phone =
      externalPhone != null && externalPhone !== ""
        ? normalizeUsPhoneToE164(externalPhone)
        : normalizeUsPhoneToE164(
            contact.phone_jsonb?.map((entry) => entry.number).find(Boolean) ??
              "",
          );
    const { data: existing = [] } = await baseDataProvider.getList<
      import("@/modules/types").Conversation
    >("conversations", {
      filter: phone
        ? { "type@eq": "client", "external_phone@eq": phone }
        : { "type@eq": "client", "contact_id@eq": contactId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    if (existing[0]) {
      return existing[0];
    }
    const title =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      phone ||
      "Client SMS";
    const { data: created } = await baseDataProvider.create<
      import("@/modules/types").Conversation
    >("conversations", {
      data: {
        type: "client",
        title,
        contact_id: contactId,
        external_phone: phone,
        created_by_member_id: authorMemberId,
        ...(dealId != null && dealId !== "" ? { deal_id: dealId } : {}),
      },
    });
    return created;
  },
};

async function updateCompany(
  companyId: Identifier,
  updateFn: (company: Company) => Partial<Company>,
) {
  const { data: company } = await dataProvider.getOne<Company>("companies", {
    id: companyId,
  });

  return await dataProvider.update("companies", {
    id: companyId,
    data: {
      ...updateFn(company),
    },
    previousData: company,
  });
}

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return (await convertFileToBase64(logo)) as string;
  }
  return logo?.src ?? "";
};

const preserveAttachmentMimeType = <
  NoteType extends { attachments?: Array<{ rawFile?: File; type?: string }> },
>(
  note: NoteType,
): NoteType => ({
  ...note,
  attachments: (note.attachments ?? []).map((attachment) => ({
    ...attachment,
    type: attachment.type ?? attachment.rawFile?.type,
  })),
});

export const dataProvider = withLifecycleCallbacks(
  withSupabaseFilterAdapter(dataProviderWithCustomMethod),
  [
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
      resource: "organization_members",
      beforeGetList: async (params) => {
        return applyFullTextSearch(["first_name", "last_name", "email"], {
          useContactFtsColumns: false,
        })(params);
      },
      beforeCreate: async (params) => {
        const { data } = params;
        // If administrator role is not set, we simply set it to false
        if (data.administrator == null) {
          data.administrator = false;
        }
        data.roles = Array.isArray(data.roles)
          ? Array.from(new Set(data.roles))
          : data.administrator
            ? ["admin"]
            : [];
        data.email = normalizeEmailValue(data.email, "email") ?? "";
        return params;
      },
      beforeUpdate: async (params) => {
        params.data.email = normalizeEmailValue(params.data.email, "email");
        if (Array.isArray(params.data.roles)) {
          params.data.roles = Array.from(new Set(params.data.roles));
        }
        return params;
      },
      afterSave: async (data) => {
        // Since the current user is stored in localStorage in fakerest authProvider
        // we need to update it to keep information up to date in the UI
        const currentUser = await authProvider.getIdentity?.();
        if (currentUser?.id === data.id) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      },
      beforeDelete: async (params) => {
        if (params.meta?.identity?.id == null) {
          throw new Error("Identity MUST be set in meta");
        }

        const newSaleId = params.meta.identity.id as Identifier;

        const [companies, contacts, contactNotes, deals] = await Promise.all([
          dataProvider.getList("companies", {
            filter: { organization_member_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("contacts", {
            filter: { organization_member_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("contact_notes", {
            filter: { organization_member_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
          dataProvider.getList("deals", {
            filter: { organization_member_id: params.id },
            pagination: {
              page: 1,
              perPage: 10_000,
            },
            sort: { field: "id", order: "ASC" },
          }),
        ]);

        await Promise.all([
          dataProvider.updateMany("companies", {
            ids: companies.data.map((company) => company.id),
            data: {
              organization_member_id: newSaleId,
            },
          }),
          dataProvider.updateMany("contacts", {
            ids: contacts.data.map((company) => company.id),
            data: {
              organization_member_id: newSaleId,
            },
          }),
          dataProvider.updateMany("contact_notes", {
            ids: contactNotes.data.map((company) => company.id),
            data: {
              organization_member_id: newSaleId,
            },
          }),
          dataProvider.updateMany("deals", {
            ids: deals.data.map((company) => company.id),
            data: {
              organization_member_id: newSaleId,
            },
          }),
        ]);

        return params;
      },
    } satisfies ResourceCallbacks<OrganizationMember>,
    {
      resource: "contacts",
      beforeCreate: async (createParams, dataProvider) => {
        const params = {
          ...createParams,
          data: {
            ...normalizeContactData(createParams.data),
            first_seen:
              createParams.data.first_seen ?? new Date().toISOString(),
            last_seen: createParams.data.last_seen ?? new Date().toISOString(),
          },
        };
        const newParams = await processContactAvatar(params);
        return fetchAndUpdateCompanyData(newParams, dataProvider);
      },
      afterCreate: async (result) => {
        if (result.data.company_id != null) {
          await updateCompany(result.data.company_id, (company) => ({
            nb_contacts: (company.nb_contacts ?? 0) + 1,
          }));
        }

        return result;
      },
      beforeUpdate: async (params) => {
        const newParams = await processContactAvatar({
          ...params,
          data: normalizeContactData(params.data),
        });
        return fetchAndUpdateCompanyData(newParams, dataProvider);
      },
      afterDelete: async (result) => {
        if (result.data.company_id != null) {
          await updateCompany(result.data.company_id, (company) => ({
            nb_contacts: (company.nb_contacts ?? 1) - 1,
          }));
        }

        return result;
      },
    } satisfies ResourceCallbacks<Contact>,
    {
      resource: "tasks",
      beforeCreate: async (params) => {
        return {
          ...params,
          data: normalizeTaskCreateData(params.data as Record<string, unknown>),
        };
      },
      beforeUpdate: async (params) => {
        const { data, previousData } = params;
        if (previousData.done_date !== data.done_date) {
          taskUpdateType = data.done_date
            ? TASK_MARKED_AS_DONE
            : TASK_MARKED_AS_UNDONE;
        } else {
          taskUpdateType = TASK_DONE_NOT_CHANGED;
        }
        const normalized = normalizeTaskCreateData({
          ...(previousData as Record<string, unknown>),
          ...(data as Record<string, unknown>),
        });
        return {
          ...params,
          data: {
            ...data,
            assignee_person_ids: normalized.assignee_person_ids,
            collaborator_person_ids: normalized.collaborator_person_ids,
            mentioned_member_ids: normalized.mentioned_member_ids,
          },
        };
      },
      afterCreate: async (result, dataProvider) => {
        const payload = getTaskAssignmentPayload(result.data);
        await syncTaskAssignees(
          dataProvider,
          result.data.id,
          payload.assignee_person_ids,
          payload.collaborator_person_ids,
        );
        await syncTaskParticipants(
          dataProvider,
          result.data.id,
          payload,
          result.data.organization_member_id as Identifier | null | undefined,
        );
        await createTaskTagNotifications(
          dataProvider,
          result.data.id,
          payload.assignee_person_ids,
          payload.collaborator_person_ids,
          payload.mentioned_member_ids,
        );
        // update the task count in the related contact
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        await dataProvider.update("contacts", {
          id: contact_id,
          data: {
            nb_tasks: (contact.nb_tasks ?? 0) + 1,
          },
          previousData: contact,
        });
        return result;
      },
      afterUpdate: async (result, dataProvider) => {
        const payload = getTaskAssignmentPayload(result.data);
        await syncTaskAssignees(
          dataProvider,
          result.data.id,
          payload.assignee_person_ids,
          payload.collaborator_person_ids,
        );
        await syncTaskParticipants(
          dataProvider,
          result.data.id,
          payload,
          result.data.organization_member_id as Identifier | null | undefined,
        );
        await createTaskTagNotifications(
          dataProvider,
          result.data.id,
          payload.assignee_person_ids,
          payload.collaborator_person_ids,
          payload.mentioned_member_ids,
        );
        // update the contact: if the task is done, decrement the nb tasks, otherwise increment it
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        if (taskUpdateType !== TASK_DONE_NOT_CHANGED) {
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks:
                taskUpdateType === TASK_MARKED_AS_DONE
                  ? (contact.nb_tasks ?? 0) - 1
                  : (contact.nb_tasks ?? 0) + 1,
            },
            previousData: contact,
          });
        }
        return result;
      },
      afterDelete: async (result, dataProvider) => {
        // update the task count in the related contact
        const { contact_id } = result.data;
        const { data: contact } = await dataProvider.getOne("contacts", {
          id: contact_id,
        });
        await dataProvider.update("contacts", {
          id: contact_id,
          data: {
            nb_tasks: (contact.nb_tasks ?? 0) - 1,
          },
          previousData: contact,
        });
        return result;
      },
    } satisfies ResourceCallbacks<Task>,
    {
      resource: "companies",
      beforeCreate: async (params) => {
        params.data.phone_number = normalizePhoneValue(
          params.data.phone_number,
        );
        const createParams = await processCompanyLogo(params);

        return {
          ...createParams,
          data: {
            ...createParams.data,
            created_at: new Date().toISOString(),
          },
        };
      },
      beforeUpdate: async (params) => {
        params.data.phone_number = normalizePhoneValue(
          params.data.phone_number,
        );
        return await processCompanyLogo(params);
      },
      afterUpdate: async (result, dataProvider) => {
        // get all contacts of the company and for each contact, update the company_name
        const { id, name } = result.data;
        const { data: contacts } = await dataProvider.getList("contacts", {
          filter: { company_id: id },
          pagination: { page: 1, perPage: 1000 },
          sort: { field: "id", order: "ASC" },
        });

        const contactIds = contacts.map((contact) => contact.id);
        await dataProvider.updateMany("contacts", {
          ids: contactIds,
          data: { company_name: name },
        });
        return result;
      },
    } satisfies ResourceCallbacks<Company>,
    {
      resource: "deals",
      beforeCreate: async (params) => {
        return {
          ...params,
          data: {
            ...params.data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
      },
      afterCreate: async (result) => {
        await updateCompany(result.data.company_id, (company) => ({
          nb_deals: (company.nb_deals ?? 0) + 1,
        }));

        return result;
      },
      beforeUpdate: async (params) => {
        return {
          ...params,
          data: {
            ...params.data,
            updated_at: new Date().toISOString(),
          },
        };
      },
      afterDelete: async (result) => {
        await updateCompany(result.data.company_id, (company) => ({
          nb_deals: (company.nb_deals ?? 1) - 1,
        }));

        return result;
      },
    } satisfies ResourceCallbacks<Deal>,
    {
      resource: "contact_notes",
      beforeSave: async (params) => preserveAttachmentMimeType(params),
    } satisfies ResourceCallbacks<ContactNote>,
    {
      resource: "deal_notes",
      beforeSave: async (params) => preserveAttachmentMimeType(params),
    } satisfies ResourceCallbacks<DealNote>,
  ],
) as CrmDataProvider;

/**
 * Convert a `File` object returned by the upload input into a base 64 string.
 * That's not the most optimized way to store images in production, but it's
 * enough to illustrate the idea of dataprovider decoration.
 */
const convertFileToBase64 = (file: { rawFile: Blob }): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // We know result is a string as we used readAsDataURL
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file.rawFile);
  });

const applyFullTextSearch =
  (columns: string[], options: { useContactFtsColumns?: boolean } = {}) =>
  (params: any) => {
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
          if (useContactFtsColumns && column === "email") {
            return {
              ...acc,
              [`email_fts@ilike`]: searchTerm,
            };
          }
          if (useContactFtsColumns && column === "phone") {
            return {
              ...acc,
              [`phone_fts@ilike`]: searchTerm,
            };
          }
          return {
            ...acc,
            [`${column}@ilike`]: searchTerm,
          };
        }, {}),
      },
    };
  };
