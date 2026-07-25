import type { ReactNode } from "react";
import type { MailAccount } from "./types";
import {
  HOSTINGER_BRAND_PURPLE,
} from "./hostingerLogo";

export type MailBrandId =
  | "google"
  | "microsoft"
  | "hostinger"
  | "yahoo"
  | "generic";

export const MAIL_BRAND_LABELS: Record<MailBrandId, string> = {
  google: "Gmail",
  microsoft: "Outlook",
  hostinger: "Hostinger",
  yahoo: "Yahoo Mail",
  generic: "Email",
};

export function resolveMailBrand(
  account: Pick<MailAccount, "provider" | "email" | "imap_host" | "smtp_host">,
): MailBrandId {
  if (account.provider === "google") return "google";
  if (account.provider === "microsoft") return "microsoft";

  const hosts = `${account.imap_host ?? ""} ${account.smtp_host ?? ""}`.toLowerCase();
  if (hosts.includes("hostinger")) return "hostinger";

  const domain = account.email.split("@")[1]?.toLowerCase() ?? "";

  if (
    hosts.includes("gmail") ||
    domain === "gmail.com" ||
    domain === "googlemail.com"
  ) {
    return "google";
  }
  if (
    hosts.includes("office365") ||
    hosts.includes("outlook") ||
    hosts.includes("live.com") ||
    ["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)
  ) {
    return "microsoft";
  }
  if (hosts.includes("yahoo") || domain.endsWith("yahoo.com")) {
    return "yahoo";
  }

  return "generic";
}

function SvgWrap({
  className,
  children,
  viewBox = "0 0 24 24",
}: {
  className?: string;
  children: ReactNode;
  viewBox?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function MailBrandLogo({
  brand,
  className,
}: {
  brand: MailBrandId;
  className?: string;
}) {
  switch (brand) {
    case "google":
      return (
        <SvgWrap className={className}>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </SvgWrap>
      );
    case "microsoft":
      return (
        <SvgWrap className={className}>
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </SvgWrap>
      );
    case "hostinger":
      return (
        <SvgWrap className={className} viewBox="7.002 8.287 148.203 175.426">
          <path
            fill={HOSTINGER_BRAND_PURPLE}
            d="m7.002 8.287 39.319 21.172v39.32h57.467l36.295 21.172h-133.081zm148.203 75.615v-54.443l-42.344-21.172v51.418zm0 99.811-39.319-21.172v-39.32h-57.467l-36.295-21.172h133.081zm-148.203-75.615v54.443l42.343 21.172v-51.418z"
          />
        </SvgWrap>
      );
    case "yahoo":
      return (
        <SvgWrap className={className}>
          <rect width="24" height="24" rx="5" fill="#6001D2" />
          <path
            fill="#fff"
            d="M7.2 17V7h3.1c2.35 0 3.85 1.35 3.85 3.45 0 1.45-.75 2.55-2 3.05L16.5 17h-2.55l-3.35-3.15H9.5V17H7.2zm2.3-5.05h.75c1.15 0 1.85-.55 1.85-1.45s-.7-1.4-1.85-1.4H9.5v2.85z"
          />
        </SvgWrap>
      );
    case "generic":
    default:
      return (
        <SvgWrap className={className}>
          <rect
            width="24"
            height="24"
            rx="5"
            className="fill-muted stroke-border"
            strokeWidth="1"
          />
          <path
            fill="currentColor"
            className="text-muted-foreground"
            d="M5 8.5 12 13l7-4.5V8a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v.5zm0 2.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5.3l-6.65 4.15a1 1 0 0 1-1.05 0L5 10.7z"
          />
        </SvgWrap>
      );
  }
}

export function mailBrandAvatarClass(brand: MailBrandId): string {
  switch (brand) {
    case "google":
      return "bg-white ring-1 ring-[#dadce0] dark:bg-[#202124] dark:ring-[#5f6368]/50";
    case "microsoft":
      return "bg-white ring-1 ring-[#0078d4]/25 dark:bg-muted dark:ring-[#0078d4]/40";
    case "hostinger":
      return "bg-[#673DE6]/10 ring-1 ring-[#673DE6]/35 p-0 overflow-hidden";
    case "yahoo":
      return "bg-[#6001D2]/10 ring-1 ring-[#6001D2]/35 p-0 overflow-hidden";
    default:
      return "bg-muted ring-1 ring-border/60";
  }
}
