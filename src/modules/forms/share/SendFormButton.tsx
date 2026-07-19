import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SendFormDialog } from "@/modules/forms/share/SendFormDialog";
import type {
  SendFormButtonVariant,
  SendFormContext,
} from "@/modules/forms/share/sendFormTypes";

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
        <SendFormDialog
          open={open}
          onOpenChange={setOpen}
          context={resolvedContext}
        />
      </>
    );
  }

  const trigger =
    variant === "icon" ? (
      <IconButton
        className={className}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <FileText className="size-4" />
      </IconButton>
    ) : (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileText className="size-4" />
        {label}
      </Button>
    );

  return (
    <>
      {trigger}
      <SendFormDialog
        open={open}
        onOpenChange={setOpen}
        context={resolvedContext}
      />
    </>
  );
};
