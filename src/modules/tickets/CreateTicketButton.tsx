import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ToolbarLabel } from "@/components/atomic-crm/layout/PageActions";
import { NewTicketDialog } from "@/modules/tickets/NewTicketDialog";
import { cn } from "@/lib/utils";

export const CreateTicketButton = ({
  companyId,
  contactId,
  label = "New ticket",
  className,
  alwaysShowLabel = false,
  iconOnly = false,
}: {
  companyId?: string | number | null;
  dealId?: string | number | null;
  contactId?: string | number | null;
  label?: string;
  className?: string;
  /** Module toolbars keep the create label visible at every width. */
  alwaysShowLabel?: boolean;
  iconOnly?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {iconOnly ? (
        <IconButton
          aria-label={label}
          className={cn("size-9 text-foreground", className)}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-6" />
        </IconButton>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(className)}
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          {alwaysShowLabel ? (
            label
          ) : (
            <ToolbarLabel priority="primary">{label}</ToolbarLabel>
          )}
        </Button>
      )}
      <NewTicketDialog
        open={open}
        onOpenChange={setOpen}
        defaultCompanyId={companyId ?? null}
        defaultContactId={contactId ?? null}
      />
    </>
  );
};
