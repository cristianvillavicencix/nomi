import { Braces } from "lucide-react";
import { useMemo } from "react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  buildTicketReplyTemplateContext,
  TICKET_REPLY_VARIABLES,
} from "@/modules/tickets/ticketReplyTemplates";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TicketReplyVariablePickerProps = {
  ticket: Ticket;
  contact?: Contact | null;
  company?: Company | null;
  disabled?: boolean;
  onInsert: (token: string) => void;
};

export const TicketReplyVariablePicker = ({
  ticket,
  contact,
  company,
  disabled = false,
  onInsert,
}: TicketReplyVariablePickerProps) => {
  const previews = useMemo(
    () => buildTicketReplyTemplateContext(ticket, contact, company),
    [ticket, contact, company],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          disabled={disabled}
          title="Insert variable"
          aria-label="Insert variable"
        >
          <Braces className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Email variables
        </p>
        <ul className="space-y-1">
          {TICKET_REPLY_VARIABLES.map((variable) => (
            <li key={variable.id}>
              <button
                type="button"
                onClick={() => onInsert(variable.token)}
                className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="block text-sm font-medium">{variable.label}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                  {variable.token}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {previews[variable.id] || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
