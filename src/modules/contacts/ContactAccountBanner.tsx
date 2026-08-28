import { Building2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { getClientShowPath } from "@/app/routing";

type ContactAccountBannerProps = {
  companyId: string | number;
  companyName?: string | null;
};

/** Satellite person → Account motor deep-link. */
export const ContactAccountBanner = ({
  companyId,
  companyName,
}: ContactAccountBannerProps) => {
  const label = companyName?.trim() || "Account";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Building2
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="shrink-0 text-muted-foreground">Account</span>
        <span className="truncate font-medium text-foreground">{label}</span>
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
        <Link to={getClientShowPath(companyId)}>Open Account</Link>
      </Button>
    </div>
  );
};
