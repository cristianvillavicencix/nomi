import { useState } from "react";
import { Lock, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getPortalCopy,
  PORTAL_LOCALE_KEY,
  type PortalLocale,
} from "@/lbs/portal/portalI18n";
import { isDeliveryNew, type PortalView } from "@/lbs/portal/portalTypes";

type NavItem = {
  id: PortalView;
  label: string;
  locked?: boolean;
  badge?: string;
};

export const ClientPortalLayout = ({
  locale,
  onLocaleChange,
  activeView,
  onViewChange,
  websiteUnlocked,
  deliveryDeliveredAt,
  unreadNotifications,
  accountEmail,
  children,
}: {
  locale: PortalLocale;
  onLocaleChange: (next: PortalLocale) => void;
  activeView: PortalView;
  onViewChange: (view: PortalView) => void;
  websiteUnlocked: boolean;
  deliveryDeliveredAt?: string | null;
  unreadNotifications: number;
  accountEmail?: string | null;
  children: React.ReactNode;
}) => {
  const copy = getPortalCopy(locale);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { id: "dashboard", label: copy.dashboard },
    { id: "projects", label: copy.myProjects },
    {
      id: "website",
      label: copy.myWebsite,
      locked: !websiteUnlocked,
      badge:
        websiteUnlocked && isDeliveryNew(deliveryDeliveredAt)
          ? copy.newBadge
          : undefined,
    },
    { id: "resources", label: copy.resources, locked: !websiteUnlocked },
    { id: "security", label: copy.security, locked: !websiteUnlocked },
    { id: "billing", label: copy.billing, locked: true },
    { id: "settings", label: copy.settings },
  ];

  const renderNavButton = (item: NavItem) => {
    const isActive = activeView === item.id;
    const disabled = item.locked;

    const button = (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onViewChange(item.id);
          setMobileOpen(false);
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
          isActive
            ? "bg-[#1E5FA8] text-white"
            : disabled
              ? "cursor-not-allowed text-muted-foreground/70"
              : "text-[#0D3B6E] hover:bg-[#1E5FA8]/10",
        )}
      >
        <span className="flex items-center gap-2">
          {disabled ? <Lock className="size-4 shrink-0 opacity-70" /> : null}
          {item.label}
        </span>
        {item.badge ? (
          <Badge className="bg-[#F59E0B] text-[#0D3B6E] hover:bg-[#F59E0B]">
            {item.badge}
          </Badge>
        ) : null}
      </button>
    );

    if (!disabled) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{copy.lockedTooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6">
      <div>
        <div className="text-lg font-bold tracking-tight text-[#0D3B6E]">
          LBS Portal
        </div>
        <p className="text-xs text-muted-foreground">{copy.portalSubtitle}</p>
        {accountEmail ? (
          <p className="mt-2 truncate text-xs text-[#1E5FA8]">{accountEmail}</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <TooltipProvider delayDuration={200}>
          {navItems.map((item) => (
            <div key={item.id}>{renderNavButton(item)}</div>
          ))}
        </TooltipProvider>
      </nav>

      <div className="space-y-2 border-t pt-4">
        {unreadNotifications > 0 ? (
          <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-xs">
            {unreadNotifications} {copy.notificationTitle.toLowerCase()}
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            const next = locale === "es" ? "en" : "es";
            localStorage.setItem(PORTAL_LOCALE_KEY, next);
            onLocaleChange(next);
          }}
        >
          {copy.languageToggle}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E5FA8]/5 to-background">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-64 shrink-0 border-r bg-background/80 p-5 md:block">
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-background/90 px-4 py-3 md:hidden">
            <div className="font-semibold text-[#0D3B6E]">LBS Portal</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </header>

          {mobileOpen ? (
            <div className="border-b bg-background p-4 md:hidden">{sidebar}</div>
          ) : null}

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
};