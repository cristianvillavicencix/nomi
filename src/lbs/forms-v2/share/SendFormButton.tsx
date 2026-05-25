import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SendFormDialog } from "@/lbs/forms-v2/share/SendFormDialog";
import type {
  SendFormButtonVariant,
  SendFormContext,
} from "@/lbs/forms-v2/share/sendFormTypes";

type SendFormButtonProps = {
  context: SendFormContext;
  variant?: SendFormButtonVariant;
  label?: string;
  className?: string;
  formInstanceId?: number;
};

export const SendFormButton = ({
  context,
  variant = "button",
  label = "Send form",
  className,
  formInstanceId,
}: SendFormButtonProps) => {
  const [open, setOpen] = useState(false);
  const resolvedContext = {
    ...context,
    form_instance_id: formInstanceId ?? context.form_instance_id,
  };

  if (variant === "menu-item") {
    return (
      <>
        <DropdownMenuItem
          className={className}
          onSelect={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <FileText className="size-4" />
          {label}
        </DropdownMenuItem>
        <SendFormDialog open={open} onOpenChange={setOpen} context={resolvedContext} />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === "icon" ? "ghost" : "outline"}
        size={variant === "icon" ? "icon" : "sm"}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileText className="size-4" />
        {variant === "button" ? label : <span className="sr-only">{label}</span>}
      </Button>
      <SendFormDialog open={open} onOpenChange={setOpen} context={resolvedContext} />
    </>
  );
};
