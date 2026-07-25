import { LayoutTemplate } from "lucide-react";
import {
  TICKET_CREATE_TEMPLATES,
  renderTicketCreateTemplate,
  type TicketCreateTemplateContext,
  type TicketCreateTemplateId,
} from "@/modules/tickets/ticketCreateTemplates";

import { IconButton } from "@/components/ui/icon-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TicketCreateTemplatePickerProps = {
  context: TicketCreateTemplateContext;
  disabled?: boolean;
  onInsert: (text: string) => void;
};

export const TicketCreateTemplatePicker = ({
  context,
  disabled = false,
  onInsert,
}: TicketCreateTemplatePickerProps) => {
  const handleSelect = (templateId: TicketCreateTemplateId) => {
    onInsert(renderTicketCreateTemplate(templateId, context));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          className="text-muted-foreground"
          disabled={disabled}
          title="Insert template"
        >
          <LayoutTemplate className="size-4" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Ticket templates
        </p>
        <ul className="space-y-1">
          {TICKET_CREATE_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => handleSelect(template.id)}
                className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="block text-sm font-medium">
                  {template.label}
                </span>
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
