import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Identifier } from "ra-core";
import type { Contact } from "@/modules/types";
import { useSmsWebFormInsert } from "@/modules/messages/useSmsWebFormInsert";

export const SmsWebFormPicker = ({
  contact,
  dealId,
  onInsertLink,
  disabled,
  open,
  onOpenChange,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  onInsertLink: (url: string, label: string) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { activeForms, generateMutation } = useSmsWebFormInsert({
    contact,
    dealId,
    onInsertLink,
  });

  if (activeForms.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled || generateMutation.isPending}
          aria-label="Insert form link"
        >
          {generateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Insert form link</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeForms.map((form) => (
          <DropdownMenuItem
            key={String(form.id)}
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate(form)}
          >
            <FileText className="size-4" />
            <span className="truncate">{form.name?.trim() || form.slug}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
