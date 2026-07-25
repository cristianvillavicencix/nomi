import type { Contact } from "@/components/atomic-crm/types";
import {
  expandMessageTemplate,
  shortcutTileColor,
  templateTileLabel,
  type MessageTemplateContext,
} from "@/lib/messages/expandMessageTemplate";
import type { MessageTemplate } from "@/modules/types";
import { useMessageTemplateShortcuts } from "@/modules/messages/useMessageTemplateShortcuts";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SmsTemplateShortcutTilesProps = {
  contact?: Contact | null;
  companyName?: string | null;
  templateContext: MessageTemplateContext;
  disabled?: boolean;
  onInsert: (text: string) => void;
  className?: string;
};

export const SmsTemplateShortcutTiles = ({
  contact,
  companyName,
  templateContext,
  disabled,
  onInsert,
  className,
}: SmsTemplateShortcutTilesProps) => {
  const { templates, isPending } = useMessageTemplateShortcuts(!disabled);

  if (isPending || templates.length === 0) {
    return null;
  }

  const handleInsert = (template: MessageTemplate) => {
    const text = expandMessageTemplate(template.body, {
      ...templateContext,
      contact_first_name: contact?.first_name ?? "",
      contact_last_name: contact?.last_name ?? "",
      contact_full_name: contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : "",
      company_name: companyName ?? "",
    });
    onInsert(text);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        aria-label="Message shortcuts"
      >
        {templates.map((template, index) => {
          const label = templateTileLabel(
            template.name,
            template.shortcut_label,
          );
          const color = shortcutTileColor(template.tile_color, index);

          return (
            <Tooltip key={String(template.id)}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInsert(template)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-tight text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Insert template: ${template.name}`}
                >
                  {label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-medium">{template.name}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {template.body.length > 120
                    ? `${template.body.slice(0, 120)}…`
                    : template.body}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
