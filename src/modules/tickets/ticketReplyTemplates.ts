import type { Ticket } from "@/modules/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  getTicketClientFirstName,
  resolveTicketRequesterEmail,
  resolveTicketRequesterName,
} from "@/modules/tickets/ticketRequester";

export type TicketReplyTemplateId = string;

export type TicketReplyVariableId =
  | "clientName"
  | "clientFullName"
  | "clientEmail"
  | "companyName"
  | "subject"
  | "ticketId";

export type TicketReplyVariable = {
  id: TicketReplyVariableId;
  label: string;
  token: string;
  description: string;
};

export type TicketReplyTemplate = {
  id: TicketReplyTemplateId;
  label: string;
  description: string;
  body: string;
};

const LBS_SUPPORT_SIGNATURE = `Latinos Business Support | Marketing Digital, Páginas Web, Xactimate
(203) 303-9148 | info@lbs.bz | www.lbs.bz
1200 Summer St, Stamford, 06902 CT`;

export { LBS_SUPPORT_SIGNATURE };

export const TICKET_REPLY_VARIABLES: TicketReplyVariable[] = [
  {
    id: "clientName",
    label: "Client first name",
    token: "{{clientName}}",
    description: "Recipient first name",
  },
  {
    id: "clientFullName",
    label: "Client full name",
    token: "{{clientFullName}}",
    description: "Recipient full name",
  },
  {
    id: "clientEmail",
    label: "Client email",
    token: "{{clientEmail}}",
    description: "Recipient email address",
  },
  {
    id: "companyName",
    label: "Company name",
    token: "{{companyName}}",
    description: "Linked company",
  },
  {
    id: "subject",
    label: "Property / case",
    token: "{{subject}}",
    description: "Ticket subject or job site",
  },
  {
    id: "ticketId",
    label: "Ticket ID",
    token: "{{ticketId}}",
    description: "Internal ticket number",
  },
];

export const TICKET_REPLY_TEMPLATES: TicketReplyTemplate[] = [
  {
    id: "updated_estimate_es",
    label: "Updated estimate (ES)",
    description: "Share an updated estimate based on new files from the client.",
    body: `Hola {{clientName}},

Le compartimos una versión actualizada del estimado correspondiente al caso {{subject}}. Esta actualización fue realizada en base a los nuevos datos o archivos que nos compartió.

Si necesita realizar más ajustes o tiene información adicional que desea incluir, estamos a su disposición para ayudarle.

Quedamos atentos a cualquier consulta o comentario.

Saludos cordiales,`,
  },
];

export const buildTicketReplyTemplateContext = (
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
) => ({
  clientName: getTicketClientFirstName(ticket, contact, company),
  clientFullName: resolveTicketRequesterName(ticket, contact, company) ?? "",
  clientEmail: resolveTicketRequesterEmail(ticket, company, contact) ?? "",
  companyName: company?.name?.trim() ?? "",
  subject: ticket.subject?.trim() || "your case",
  ticketId: String(ticket.id),
});

export const expandTicketReplyTemplate = (
  template: string,
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
) => {
  const context = buildTicketReplyTemplateContext(ticket, contact, company);
  return template
    .replace(/\{\{clientName\}\}/g, context.clientName)
    .replace(/\{\{clientFullName\}\}/g, context.clientFullName)
    .replace(/\{\{clientEmail\}\}/g, context.clientEmail)
    .replace(/\{\{companyName\}\}/g, context.companyName)
    .replace(/\{\{subject\}\}/g, context.subject)
    .replace(/\{\{ticketId\}\}/g, context.ticketId);
};

export const renderTicketReplyTemplate = (
  templateId: TicketReplyTemplateId,
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
  extraTemplates: TicketReplyTemplate[] = [],
) => {
  const template =
    [...TICKET_REPLY_TEMPLATES, ...extraTemplates].find(
      (row) => row.id === templateId,
    ) ?? null;
  if (!template) return "";
  return expandTicketReplyTemplate(template.body, ticket, contact, company);
};
