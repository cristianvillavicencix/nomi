import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTicketDialog } from "@/modules/tickets/NewTicketDialog";
import { cn } from "@/lib/utils";

export const CreateTicketButton = ({
  companyId,
  contactId,
  label = "New ticket",
  className,
}: {
  companyId?: string | number | null;
  dealId?: string | number | null;
  contactId?: string | number | null;
  label?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        {label}
      </Button>
      <NewTicketDialog
        open={open}
        onOpenChange={setOpen}
        defaultCompanyId={companyId ?? null}
        defaultContactId={contactId ?? null}
      />
    </>
  );
};
