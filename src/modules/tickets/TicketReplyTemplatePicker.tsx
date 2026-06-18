import { LayoutTemplate } from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  TICKET_REPLY_TEMPLATES,
  renderTicketReplyTemplate,
  type TicketReplyTemplateId,
} from "@/modules/tickets/ticketReplyTemplates";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TicketReplyTemplatePickerProps = {
  ticket: Ticket;
  contact?: Contact | null;
  company?: Company | null;
  disabled?: boolean;
  onInsert: (text: string) => void;
};

export const TicketReplyTemplatePicker = ({
  ticket,
  contact,
  company,
  disabled = false,
  onInsert,
}: TicketReplyTemplatePickerProps) => {
  const handleSelect = (templateId: TicketReplyTemplateId) => {
    onInsert(renderTicketReplyTemplate(templateId, ticket, contact, company));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          disabled={disabled}
          title="Insert template"
        >
          <LayoutTemplate className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Reply templates
        </p>
        <ul className="space-y-1">
          {TICKET_REPLY_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => handleSelect(template.id)}
                className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="block text-sm font-medium">{template.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {template.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
