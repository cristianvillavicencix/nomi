import { FileText } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getClientProposalCreatePath,
  getLeadProposalCreatePath,
} from "@/lbs/routing";

export const CreateProposalButton = ({
  companyId,
  contactId,
  dealId,
  variant = "default",
  size = "sm",
  className,
}: {
  companyId?: string | number | null;
  contactId?: string | number | null;
  dealId?: string | number | null;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
}) => {
  const href =
    contactId != null && companyId == null
      ? getLeadProposalCreatePath(contactId, null, dealId)
      : getClientProposalCreatePath(companyId, contactId, dealId);

  return (
    <Button variant={variant} size={size} asChild className={className}>
      <Link to={href}>
        <FileText className="size-4" />
        Create proposal
      </Link>
    </Button>
  );
};
