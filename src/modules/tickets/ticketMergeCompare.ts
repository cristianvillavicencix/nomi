import type { Company, Contact } from "@/components/atomic-crm/types";
import type { OrganizationMember, Ticket } from "@/modules/types";
import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import { ticketPriorityLabel } from "@/modules/tickets/ticketPriorityUi";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { memberDisplayName } from "@/modules/tickets/ticketInboxUi";
import type { Identifier } from "ra-core";

export type TicketMergeFieldKey =
  | "subject"
  | "requester_name"
  | "requester_email"
  | "phone"
  | "status"
  | "priority"
  | "assignee_id"
  | "company_id"
  | "contact_id"
  | "deal_id";

export type TicketMergeFieldOverrides = Partial<{
  subject: string;
  status: string;
  priority: string;
  requester_email: string | null;
  requester_name: string | null;
  assignee_id: number | null;
  company_id: number | null;
  contact_id: number | null;
  deal_id: number | null;
}>;

export type TicketMergeRow = {
  key: TicketMergeFieldKey | "created_at" | "updated_at";
  label: string;
  left: string;
  right: string;
  locked?: boolean;
};

export type TicketMergeSideSnapshot = {
  ticketId: Identifier;
  subject: string;
  status: string;
  rawStatus: string;
  priority: string;
  rawPriority: string;
  requesterName: string | null;
  requesterEmail: string | null;
  phone: string | null;
  assigneeId: Identifier | null;
  assigneeName: string;
  companyId: Identifier | null;
  companyName: string;
  contactId: Identifier | null;
  contactName: string;
  dealId: Identifier | null;
  dealName: string;
  createdAt: string;
  updatedAt: string;
};

const display = (value?: string | null) => value?.trim() || "—";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const buildTicketMergeSnapshot = ({
  ticket,
  contact,
  company,
  dealName,
  assignee,
}: {
  ticket: Ticket;
  contact?: Contact | null;
  company?: Company | null;
  dealName?: string | null;
  assignee?: OrganizationMember | null;
}): TicketMergeSideSnapshot => {
  const meta = getTicketListMeta(ticket, company, contact);
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
    : "";

  return {
    ticketId: ticket.id,
    subject: display(ticket.subject),
    status: ticketStatusLabel(ticket.status),
    rawStatus: ticket.status?.trim() || "open",
    priority: ticketPriorityLabel(ticket.priority) || display(ticket.priority),
    rawPriority: ticket.priority?.trim() || "normal",
    requesterName: display(ticket.requester_name || contactName || null),
    requesterEmail: display(meta.email),
    phone: display(meta.phone),
    assigneeId: ticket.assignee_id ?? null,
    assigneeName: assignee ? memberDisplayName(assignee) : "Unassigned",
    companyId: ticket.company_id ?? null,
    companyName: display(company?.name),
    contactId: ticket.contact_id ?? null,
    contactName: contactName || display(ticket.requester_name),
    dealId: ticket.deal_id ?? null,
    dealName: display(dealName),
    createdAt: formatDateTime(ticket.created_at),
    updatedAt: formatDateTime(ticket.updated_at),
  };
};

export const buildTicketMergeRows = (
  left: TicketMergeSideSnapshot,
  right: TicketMergeSideSnapshot,
): TicketMergeRow[] => [
  {
    key: "requester_name",
    label: "Contact name",
    left: left.requesterName,
    right: right.requesterName,
  },
  {
    key: "requester_email",
    label: "Email",
    left: left.requesterEmail,
    right: right.requesterEmail,
  },
  { key: "phone", label: "Phone", left: left.phone, right: right.phone },
  {
    key: "subject",
    label: "Subject",
    left: left.subject,
    right: right.subject,
  },
  { key: "status", label: "Status", left: left.status, right: right.status },
  {
    key: "priority",
    label: "Priority",
    left: left.priority,
    right: right.priority,
  },
  {
    key: "assignee_id",
    label: "Assignee",
    left: left.assigneeName,
    right: right.assigneeName,
  },
  {
    key: "company_id",
    label: "Account",
    left: left.companyName,
    right: right.companyName,
  },
  {
    key: "contact_id",
    label: "Contact",
    left: left.contactName,
    right: right.contactName,
  },
  { key: "deal_id", label: "Project", left: left.dealName, right: right.dealName },
  {
    key: "created_at",
    label: "Created",
    left: left.createdAt,
    right: right.createdAt,
    locked: true,
  },
  {
    key: "updated_at",
    label: "Updated",
    left: left.updatedAt,
    right: right.updatedAt,
    locked: true,
  },
];

export const defaultTicketMergeFieldSides = (
  primarySide: "left" | "right",
): Record<TicketMergeFieldKey, "left" | "right"> => ({
  subject: primarySide,
  requester_name: primarySide,
  requester_email: primarySide,
  phone: primarySide,
  status: primarySide,
  priority: primarySide,
  assignee_id: primarySide,
  company_id: primarySide,
  contact_id: primarySide,
  deal_id: primarySide,
});

export const buildTicketMergeFieldOverrides = (
  left: TicketMergeSideSnapshot,
  right: TicketMergeSideSnapshot,
  fieldSides: Record<TicketMergeFieldKey, "left" | "right">,
): TicketMergeFieldOverrides => {
  const pick = (side: "left" | "right") => (side === "left" ? left : right);
  const overrides: TicketMergeFieldOverrides = {};

  for (const key of Object.keys(fieldSides) as TicketMergeFieldKey[]) {
    const snapshot = pick(fieldSides[key]);
    switch (key) {
      case "subject":
        overrides.subject = snapshot.subject === "—" ? "" : snapshot.subject;
        break;
      case "requester_name":
        overrides.requester_name =
          snapshot.requesterName === "—" ? null : snapshot.requesterName;
        break;
      case "requester_email":
        overrides.requester_email =
          snapshot.requesterEmail === "—" ? null : snapshot.requesterEmail;
        break;
      case "status":
        overrides.status = snapshot.rawStatus;
        break;
      case "priority":
        overrides.priority = snapshot.rawPriority;
        break;
      case "assignee_id":
        overrides.assignee_id = snapshot.assigneeId
          ? Number(snapshot.assigneeId)
          : null;
        break;
      case "company_id":
        overrides.company_id = snapshot.companyId
          ? Number(snapshot.companyId)
          : null;
        break;
      case "contact_id":
        overrides.contact_id = snapshot.contactId
          ? Number(snapshot.contactId)
          : null;
        break;
      case "deal_id":
        overrides.deal_id = snapshot.dealId ? Number(snapshot.dealId) : null;
        break;
      case "phone":
        break;
    }
  }

  return overrides;
};
