import { Plus } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CreateTicketButton = ({
  companyId,
  dealId,
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
  const params = new URLSearchParams();
  if (companyId != null) params.set("company_id", String(companyId));
  if (dealId != null) params.set("deal_id", String(dealId));
  if (contactId != null) params.set("contact_id", String(contactId));
  const query = params.toString();

  return (
    <Link
      to={`/tickets/create${query ? `?${query}` : ""}`}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        className,
      )}
    >
      <Plus className="size-4" />
      {label}
    </Link>
  );
};
