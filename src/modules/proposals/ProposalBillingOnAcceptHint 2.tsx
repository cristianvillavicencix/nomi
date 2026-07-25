import { Info } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { Proposal } from "@/modules/types";

export const ProposalBillingOnAcceptHint = ({
  proposal,
  className,
  variant = "default",
}: {
  proposal: Pick<Proposal, "status">;
  className?: string;
  variant?: "default" | "inline";
}) => {
  const accepted = proposal.status === "accepted";

  if (accepted) {
    return (
      <p
        className={cn(
          "text-xs leading-snug text-muted-foreground",
          className,
        )}
      >
        Client invoices are in{" "}
        <Link
          to="/billing"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Billing
        </Link>{" "}
        (created when this proposal was accepted).
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "text-xs leading-snug text-muted-foreground",
          className,
        )}
      >
        Invoices will be created in{" "}
        <span className="font-medium text-foreground">Billing</span> when the
        client accepts this proposal.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs leading-snug text-muted-foreground",
        className,
      )}
    >
      <Info
        className="mt-0.5 size-3.5 shrink-0 text-primary"
        aria-hidden
      />
      <p>
        Invoices are not created while you edit or review. They will appear in{" "}
        <span className="font-medium text-foreground">Billing</span> when the
        client accepts this proposal.
      </p>
    </div>
  );
};
