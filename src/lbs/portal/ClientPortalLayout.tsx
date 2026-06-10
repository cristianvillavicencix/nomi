import { useMemo } from "react";
import { Link } from "react-router";
import {
  ClipboardCopy,
  FileText,
  Folder,
  Globe,
  Headphones,
  KeyRound,
  Mail,
  Megaphone,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react";
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
  icon: React.ReactNode;
};

export const ClientPortalLayout = ({
  mode = "full",
  locale,
  onLocaleChange,
  activeView,
  onViewChange,
  websiteUnlocked,
  deliveryDeliveredAt,
  unreadNotifications,
  accountEmail,
  fullPortalHref,
  children,
}: {
  mode?: "full" | "invoice";
  locale: PortalLocale;
  onLocaleChange: (next: PortalLocale) => void;
  activeView?: PortalView;
  onViewChange?: (view: PortalView) => void;
  websiteUnlocked?: boolean;
  deliveryDeliveredAt?: string | null;
  unreadNotifications?: number;
  accountEmail?: string | null;
  fullPortalHref?: string | null;
  children: React.ReactNode;
}) => {
  const copy = getPortalCopy(locale);
  const navItems: NavItem[] = useMemo(
    () => [
      { id: "general", label: "General", icon: <ClipboardCopy className="size-4" /> },
      { id: "credentials", label: "Credenciales", icon: <KeyRound className="size-4" /> },
      { id: "corporate_email", label: "Correo corporativo", icon: <Mail className="size-4" /> },
      { id: "domain_dns", label: "Dominio y DNS", icon: <Globe className="size-4" /> },
      { id: "files", label: "Archivos del proyecto", icon: <Folder className="size-4" /> },
      { id: "marketing_seo", label: "Marketing y SEO", icon: <Megaphone className="size-4" /> },
      { id: "training", label: "Capacitación", icon: <GraduationCap className="size-4" /> },
      { id: "support", label: "Soporte", icon: <Headphones className="size-4" /> },
    ],
    [],
  );

  const invoiceMode = mode === "invoice";

  const languageToggle = (
    <button
      type="button"
      className="shrink-0 rounded-md border px-2 py-1.5 text-xs"
      onClick={() => {
        const next = locale === "es" ? "en" : "es";
        localStorage.setItem(PORTAL_LOCALE_KEY, next);
        onLocaleChange(next);
      }}
    >
      {copy.languageToggle}
    </button>
  );

  const sidebarNav = invoiceMode ? (
    <>
      <div
        className={cn(
          "relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#0D3B6E] bg-muted/30",
        )}
      >
        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-emerald-500" />
        <span className="text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <span className="text-[13px]">Invoice</span>
      </div>
      {fullPortalHref ? (
        <Link
          to={fullPortalHref}
          className="relative mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#0D3B6E] hover:bg-muted/40"
        >
          <span className="text-muted-foreground">
            <LayoutDashboard className="size-4" />
          </span>
          <span className="text-[13px]">My project</span>
        </Link>
      ) : null}
    </>
  ) : (
    navItems.map((item) => {
      const isActive = activeView === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onViewChange?.(item.id)}
          className={cn(
            "relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#0D3B6E] hover:bg-muted/40",
            isActive && "bg-muted/30",
          )}
        >
          <span
            className={cn(
              "absolute left-0 top-1 bottom-1 w-[3px] rounded-r",
              isActive ? "bg-emerald-500" : "bg-transparent",
            )}
          />
          <span className="text-muted-foreground">{item.icon}</span>
          <span className="text-[13px]">{item.label}</span>
        </button>
      );
    })
  );

  const mobileNavItems = invoiceMode
    ? [
        { id: "invoice" as const, label: "Invoice", href: null as string | null },
        ...(fullPortalHref
          ? [{ id: "portal" as const, label: "My project", href: fullPortalHref }]
          : []),
      ]
    : navItems.map((item) => ({
        id: item.id,
        label: item.label,
        href: null as string | null,
      }));

  const showMobileNav = !invoiceMode || Boolean(fullPortalHref);
  const mobileHeaderClass = invoiceMode ? "lg:hidden" : "md:hidden";
  const sidebarClass = invoiceMode ? "hidden lg:flex" : "hidden md:flex";

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-hidden",
        invoiceMode ? "bg-slate-50 lg:bg-white" : "bg-white",
      )}
    >
      <header className={cn("border-b bg-white", mobileHeaderClass)}>
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-[#0D3B6E]">
              Nomi Portal
            </div>
            {accountEmail ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {accountEmail}
              </div>
            ) : null}
            {!invoiceMode && websiteUnlocked && isDeliveryNew(deliveryDeliveredAt) ? (
              <div className="mt-1 text-[11px] font-medium text-emerald-700">
                {copy.newBadge}
              </div>
            ) : null}
          </div>
          {languageToggle}
        </div>

        {showMobileNav ? (
          <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileNavItems.map((item) => {
            const isActive = invoiceMode
              ? item.id === "invoice"
              : activeView === item.id;

            if ("href" in item && item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className="shrink-0 rounded-md px-3 py-2 text-[13px] text-[#0D3B6E] hover:bg-muted/40"
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!invoiceMode) onViewChange?.(item.id as PortalView);
                }}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-[13px] text-[#0D3B6E]",
                  isActive ? "bg-muted/30 font-medium" : "hover:bg-muted/40",
                )}
              >
                {item.label}
              </button>
            );
          })}
          </nav>
        ) : null}
      </header>

      <div
        className={cn(
          "flex",
          invoiceMode ? "min-h-[calc(100dvh-3rem)] lg:min-h-screen" : "min-h-[calc(100dvh-4.5rem)] md:min-h-screen",
          !invoiceMode && !showMobileNav && "min-h-[calc(100dvh-3rem)]",
        )}
      >
        <aside className={cn("w-[190px] shrink-0 border-r bg-white", sidebarClass)}>
          <div className="flex h-full w-full flex-col">
            <div className="px-4 py-4">
              <div className="text-sm font-semibold tracking-tight text-[#0D3B6E]">
                Nomi Portal
              </div>
              {accountEmail ? (
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                  {accountEmail}
                </div>
              ) : null}
              {!invoiceMode && websiteUnlocked && isDeliveryNew(deliveryDeliveredAt) ? (
                <div className="mt-2 text-[11px] font-medium text-emerald-700">
                  {copy.newBadge}
                </div>
              ) : null}
            </div>

            <nav className="flex-1 px-2 py-2">{sidebarNav}</nav>

            <div className="border-t p-3">
              {languageToggle}
              {!invoiceMode && (unreadNotifications ?? 0) > 0 ? (
                <div className="mt-2 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {unreadNotifications} {copy.notificationTitle.toLowerCase()}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden",
            invoiceMode ? "bg-slate-50 lg:bg-white" : "bg-white",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
