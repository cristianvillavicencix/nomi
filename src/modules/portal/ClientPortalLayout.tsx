import { Link } from "react-router";
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
          <div className="flex items-center gap-3">
            {fullPortalHref ? (
              <Link
                to={fullPortalHref}
                className="text-xs font-medium text-brand-navy underline-offset-4 hover:underline"
              >
                My project
              </Link>
            ) : null}
            {languageToggle}
          </div>
        </div>
      </header>
      <main className="min-w-0 overflow-x-hidden bg-slate-50 lg:bg-white">
        {children}
      </main>
    </div>
  );
};
