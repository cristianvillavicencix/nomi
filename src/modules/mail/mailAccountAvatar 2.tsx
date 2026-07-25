import { UsersThree } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MailAccount } from "./types";
import {
  MailBrandLogo,
  MAIL_BRAND_LABELS,
  mailBrandAvatarClass,
  resolveMailBrand,
} from "./mailProviderBrand";

export function mailAccountInitials(account: MailAccount): string {
  const name = account.display_name?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  const local = account.email.split("@")[0] ?? account.email;
  return local.slice(0, 2).toUpperCase();
}

export function MailAccountAvatar({
  account,
  className,
  size = "sm",
}: {
  account: MailAccount;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const brand = resolveMailBrand(account);
  const sizeClass =
    size === "md" ? "size-8" : size === "xs" ? "size-5" : "size-7";
  const logoClass =
    size === "md" ? "size-5" : size === "xs" ? "size-3" : "size-[18px]";
  const hostingerOrYahoo = brand === "hostinger" || brand === "yahoo";

  return (
    <Avatar
      className={cn(sizeClass, className)}
      aria-label={`${MAIL_BRAND_LABELS[brand]} · ${account.email}`}
    >
      <AvatarFallback
        className={cn(
          "p-1",
          hostingerOrYahoo && "p-0",
          mailBrandAvatarClass(brand),
        )}
      >
        <MailBrandLogo
          brand={brand}
          className={cn(
            hostingerOrYahoo ? "size-full rounded-[inherit]" : logoClass,
          )}
        />
      </AvatarFallback>
    </Avatar>
  );
}

export function MailAllAccountsAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-full",
        "bg-background ring-1 ring-border/60",
        className,
      )}
      aria-hidden
    >
      <span className="absolute left-1 top-1 size-3 overflow-hidden rounded-full bg-white ring-1 ring-[#dadce0]">
        <MailBrandLogo brand="google" className="size-full scale-110" />
      </span>
      <span className="absolute bottom-0.5 right-0.5 size-3 overflow-hidden rounded-sm bg-white ring-1 ring-[#0078d4]/30">
        <MailBrandLogo brand="microsoft" className="size-full" />
      </span>
      <UsersThree className="size-3.5 text-muted-foreground" weight="duotone" />
    </span>
  );
}
