import { LBS_SUPPORT_SIGNATURE } from "@/modules/tickets/ticketReplyTemplates";

export type TicketCreateTemplateId = "welcome_es";

export type TicketCreateTemplate = {
  id: TicketCreateTemplateId;
  label: string;
  description: string;
  body: string;
};

export type TicketCreateTemplateContext = {
  clientName: string;
  subject: string;
};

export const TICKET_CREATE_TEMPLATES: TicketCreateTemplate[] = [
  {
    id: "welcome_es",
    label: "Welcome (ES)",
    description: "Greeting message for a new support case.",
    body: `Hola {{clientName}},

Gracias por contactar a Latino Business Support. Hemos registrado su caso relacionado con {{subject}} y nuestro equipo lo revisará a la brevedad.

Si tiene documentos o información adicional, puede responder a este hilo o escribirnos a supplements@lbs.bz.

Saludos cordiales,

${LBS_SUPPORT_SIGNATURE}`,
  },
];

export const expandTicketCreateTemplate = (
  template: string,
  context: TicketCreateTemplateContext,
) =>
  template
    .replace(/\{\{clientName\}\}/g, context.clientName)
    .replace(/\{\{subject\}\}/g, context.subject);

export const renderTicketCreateTemplate = (
  templateId: TicketCreateTemplateId,
  context: TicketCreateTemplateContext,
) => {
  const template = TICKET_CREATE_TEMPLATES.find((row) => row.id === templateId);
  if (!template) return "";
  return expandTicketCreateTemplate(template.body, context);
};
