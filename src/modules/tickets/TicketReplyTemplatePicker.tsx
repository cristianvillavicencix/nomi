import { LayoutTemplate, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketInbox } from "@/modules/types";
import { TicketReplyTemplateCreateDialog } from "@/modules/tickets/TicketReplyTemplateCreateDialog";
import {
  mergeTicketReplyTemplates,
  parseInboxReplyTemplates,
} from "@/modules/tickets/ticketReplyTemplateStorage";
import {
  expandTicketReplyTemplate,
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
  inbox?: TicketInbox | null;
  contact?: Contact | null;
  company?: Company | null;
  disabled?: boolean;
  onInsert: (text: string) => void;
};

export const TicketReplyTemplatePicker = ({
  ticket,
  inbox,
  contact,
  company,
  disabled = false,
  onInsert,
}: TicketReplyTemplatePickerProps) => {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const customTemplates = useMemo(
    () => parseInboxReplyTemplates(inbox?.reply_templates),
    [inbox?.reply_templates],
  );

  const templates = useMemo(
    () => mergeTicketReplyTemplates(customTemplates),
    [customTemplates],
  );

  const customReplyTemplates = useMemo(
    () =>
      customTemplates.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description?.trim() || "Custom template",
        body: row.body,
      })),
    [customTemplates],
  );

  const handleSelect = (templateId: TicketReplyTemplateId) => {
    onInsert(
      renderTicketReplyTemplate(
        templateId,
        ticket,
        contact,
        company,
        customReplyTemplates,
      ),
    );
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
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
            {templates.map((template) => (
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
          <div className="mt-2 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
              disabled={!inbox?.id}
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              Create template
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <TicketReplyTemplateCreateDialog
        inbox={inbox ?? null}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(template) => {
          onInsert(
            expandTicketReplyTemplate(
              template.body,
              ticket,
              contact,
              company,
            ),
          );
        }}
      />
    </>
  );
};
