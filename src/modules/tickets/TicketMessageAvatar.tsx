import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FaviconAvatarImage } from "@/components/ui/FaviconAvatarImage";
import { getCompanyFaviconSources } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import type { Company } from "@/components/atomic-crm/types";
import { getFaviconSourcesForWebsite } from "@/lib/faviconSources";
import { cn } from "@/lib/utils";

const PUBLIC_EMAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.es",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
]);

const initialsFromLabel = (label: string) => {
  const parts = label
    .trim()
    .split(/[\s._@-]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  const single = parts[0] ?? "?";
  return single.slice(0, 2).toUpperCase();
};

const faviconSourcesFromEmail = (email?: string | null) => {
  const host = email?.split("@")[1]?.trim().toLowerCase();
  if (!host || PUBLIC_EMAIL_HOSTS.has(host)) return [];
  return getFaviconSourcesForWebsite(host);
};

export const TicketMessageAvatar = ({
  direction,
  displayName,
  email,
  company,
  orgWebsite,
  className,
}: {
  direction: "inbound" | "outbound" | "internal";
  displayName: string;
  email?: string | null;
  company?: Company | null;
  /** Own-org website for outbound / internal avatars. */
  orgWebsite?: string | null;
  className?: string;
}) => {
  const sources = useMemo(() => {
    if (direction === "inbound") {
      if (company) {
        const fromCompany = getCompanyFaviconSources(company);
        if (fromCompany.length) return fromCompany;
      }
      return faviconSourcesFromEmail(email);
    }
    if (orgWebsite?.trim()) {
      return getFaviconSourcesForWebsite(orgWebsite);
    }
    return [];
  }, [company, direction, email, orgWebsite]);

  const initials = initialsFromLabel(
    displayName || email?.split("@")[0] || "?",
  );

  return (
    <Avatar className={cn("size-8 shrink-0", className)}>
      <FaviconAvatarImage
        sources={sources}
        alt={displayName || "Sender"}
        className="object-contain p-0.5"
      />
      <AvatarFallback className="bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
