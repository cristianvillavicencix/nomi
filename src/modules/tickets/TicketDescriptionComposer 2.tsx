import { useInput } from "ra-core";
import { TicketCreateTemplatePicker } from "@/modules/tickets/TicketCreateTemplatePicker";
import type { TicketCreateTemplateContext } from "@/modules/tickets/ticketCreateTemplates";
import { Textarea } from "@/components/ui/textarea";

type TicketDescriptionComposerProps = {
  templateContext: TicketCreateTemplateContext;
  disabled?: boolean;
};

export const TicketDescriptionComposer = ({
  templateContext,
  disabled = false,
}: TicketDescriptionComposerProps) => {
  const { field } = useInput({
    source: "description",
    label: false,
    helperText: false,
  });

  const handleInsertTemplate = (text: string) => {
    const current = String(field.value ?? "").trim();
    field.onChange(current ? `${current}\n\n${text}` : text);
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="border-b px-4 py-2.5 text-xs text-muted-foreground">
        Description — initial context for your team
      </div>

      <Textarea
        value={field.value ?? ""}
        onChange={(event) => field.onChange(event.target.value)}
        placeholder="Describe the request, scope, or notes for this ticket..."
        rows={5}
        disabled={disabled}
        className="min-h-[140px] resize-none rounded-none border-0 px-4 py-3 shadow-none focus-visible:ring-0"
      />

      <div className="flex items-center border-t px-3 py-2">
        <TicketCreateTemplatePicker
          context={templateContext}
          disabled={disabled}
          onInsert={handleInsertTemplate}
        />
      </div>
    </div>
  );
};
