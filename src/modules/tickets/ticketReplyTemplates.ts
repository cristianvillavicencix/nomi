import type { Ticket } from "@/modules/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getTicketClientFirstName } from "@/modules/tickets/ticketRequester";

export type TicketReplyTemplateId = "updated_estimate_es";

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
  subject: ticket.subject?.trim() || "su caso",
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
    .replace(/\{\{subject\}\}/g, context.subject);
};

export const renderTicketReplyTemplate = (
  templateId: TicketReplyTemplateId,
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
) => {
  const template = TICKET_REPLY_TEMPLATES.find((row) => row.id === templateId);
  if (!template) return "";
  return expandTicketReplyTemplate(template.body, ticket, contact, company);
};
