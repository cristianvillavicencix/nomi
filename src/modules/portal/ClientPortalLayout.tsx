import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  getPortalCopy,
  PORTAL_LOCALE_KEY,
  type PortalLocale,
} from "@/modules/portal/portalI18n";

export const ClientPortalLayout = ({
  mode = "full",
  locale,
  onLocaleChange,
  fullPortalHref,
  children,
}: {
  mode?: "full" | "invoice";
  locale: PortalLocale;
  onLocaleChange: (next: PortalLocale) => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
  websiteUnlocked?: boolean;
  deliveryDeliveredAt?: string | null;
  unreadNotifications?: number;
  accountEmail?: string | null;
  fullPortalHref?: string | null;
  children: React.ReactNode;
}) => {
  const copy = getPortalCopy(locale);
  const invoiceMode = mode === "invoice";

  const languageToggle = (
    <button
      type="button"
      className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      onClick={() => {
        const next = locale === "es" ? "en" : "es";
        localStorage.setItem(PORTAL_LOCALE_KEY, next);
        onLocaleChange(next);
      }}
    >
      {copy.languageToggle}
    </button>
  );

  const invoiceNavItems = [
    { id: "invoice" as const, label: "Invoice", href: null as string | null },
    ...(fullPortalHref
      ? [{ id: "portal" as const, label: "My project", href: fullPortalHref }]
      : []),
  ];

  if (!invoiceMode) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-white">{children}</div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 lg:bg-white">
      <header className="border-b bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-sm font-medium text-brand-navy">Invoice</span>
          {languageToggle}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 sm:px-4">
          {invoiceNavItems.map((item) => {
            const isActive = item.id === "invoice";
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className="shrink-0 rounded-md px-3 py-2 text-[13px] text-brand-navy hover:bg-muted/40"
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <span
                key={item.id}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-[13px] text-brand-navy",
                  isActive ? "bg-muted/30 font-medium" : "",
                )}
              >
                {item.label}
              </span>
            );
          })}
        </nav>
      </header>
      <main className="min-w-0 overflow-x-hidden bg-slate-50 lg:bg-white">
        {children}
      </main>
    </div>
  );
};
