import {
  CalendarClock,
  FileText,
  Loader2,
  Paperclip,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Identifier } from "ra-core";
import type { Contact } from "@/modules/types";
import { useSmsWebFormInsert } from "@/modules/messages/useSmsWebFormInsert";
import { useSmsBookNowInsert } from "@/modules/messages/useSmsBookNowInsert";
import { cn } from "@/lib/utils";

export const SmsComposerActionsMenu = ({
  contact,
  dealId,
  disabled,
  isSending,
  isInternalNote,
  onInternalNoteChange,
  canWriteInternalNotes,
  includeSignature,
  onIncludeSignatureChange,
  hasSignature,
  signatureRequired = false,
  onAttachFile,
  onInsertFormLink,
  compact,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  disabled?: boolean;
  isSending?: boolean;
  isInternalNote: boolean;
  onInternalNoteChange: (checked: boolean) => void;
  canWriteInternalNotes: boolean;
  includeSignature: boolean;
  onIncludeSignatureChange: (checked: boolean) => void;
  hasSignature: boolean;
  signatureRequired?: boolean;
  onAttachFile: () => void;
  onInsertFormLink: (url: string, label: string) => void;
  compact?: boolean;
}) => {
  const { activeForms, generateMutation } = useSmsWebFormInsert({
    contact,
    dealId,
    onInsertLink: onInsertFormLink,
  });
  const { generateMutation: bookNowMutation } = useSmsBookNowInsert({
    contact,
    dealId,
    onInsertLink: onInsertFormLink,
  });

  const menuDisabled =
    disabled ||
    isSending ||
    generateMutation.isPending ||
    bookNowMutation.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-lg text-foreground hover:bg-muted/80",
            compact ? "size-8" : "size-9",
          )}
          disabled={menuDisabled}
          aria-label="Message options"
        >
          {generateMutation.isPending || bookNowMutation.isPending ? (
            <Loader2 className={compact ? "size-4" : "size-5"} />
          ) : (
            <Plus className={compact ? "size-4" : "size-5"} strokeWidth={2} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Options
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canWriteInternalNotes ? (
          <DropdownMenuCheckboxItem
            checked={isInternalNote}
            onCheckedChange={(value) => onInternalNoteChange(value === true)}
            disabled={menuDisabled}
          >
            Internal note
          </DropdownMenuCheckboxItem>
        ) : null}
        {hasSignature && !signatureRequired ? (
          <DropdownMenuCheckboxItem
            checked={includeSignature}
            onCheckedChange={(value) =>
              onIncludeSignatureChange(value === true)
            }
            disabled={menuDisabled || isInternalNote}
          >
            Include signature
          </DropdownMenuCheckboxItem>
        ) : null}
        <DropdownMenuItem
          disabled={menuDisabled || isInternalNote}
          onClick={onAttachFile}
        >
          <Paperclip className="size-4" />
          Attach file
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={menuDisabled || isInternalNote}
          onClick={() => bookNowMutation.mutate()}
        >
          <CalendarClock className="size-4" />
          Book now
        </DropdownMenuItem>
        {activeForms.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={menuDisabled || isInternalNote}>
              <FileText className="size-4" />
              Insert form
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {activeForms.map((form) => (
                <DropdownMenuItem
                  key={String(form.id)}
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate(form)}
                >
                  <span className="truncate">
                    {form.name?.trim() || form.slug}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
