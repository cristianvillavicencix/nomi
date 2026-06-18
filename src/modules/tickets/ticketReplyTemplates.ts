import type { Ticket } from "@/modules/types";

export type TicketReplyTemplateId = "updated_estimate_es";

export type TicketReplyTemplate = {
  id: TicketReplyTemplateId;
  label: string;
  description: string;
  body: string;
};

const LBS_SUPPORT_SIGNATURE = `Latinos Business Support | Marketing Digital, Páginas Web, Xactimate
(203) 303-9148 | ✉️ info@lbs.bz | www.lbs.bz
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

export const getTicketClientFirstName = (ticket: Ticket) => {
  const name = ticket.requester_name?.trim();
  if (!name) return "there";
  const [firstName] = name.split(/\s+/);
  return firstName || name;
};

export const buildTicketReplyTemplateContext = (ticket: Ticket) => ({
  clientName: getTicketClientFirstName(ticket),
  subject: ticket.subject?.trim() || "su caso",
});

export const expandTicketReplyTemplate = (
  template: string,
  ticket: Ticket,
) => {
  const context = buildTicketReplyTemplateContext(ticket);
  return template
    .replace(/\{\{clientName\}\}/g, context.clientName)
    .replace(/\{\{subject\}\}/g, context.subject);
};

export const renderTicketReplyTemplate = (
  templateId: TicketReplyTemplateId,
  ticket: Ticket,
) => {
  const template = TICKET_REPLY_TEMPLATES.find((row) => row.id === templateId);
  if (!template) return "";
  return expandTicketReplyTemplate(template.body, ticket);
};
