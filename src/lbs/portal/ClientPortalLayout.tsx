import { useMemo } from "react";
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

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen">
        <aside className="w-[190px] shrink-0 border-r bg-white">
          <div className="flex h-full flex-col">
            <div className="px-4 py-4">
              <div className="text-sm font-semibold tracking-tight text-[#0D3B6E]">
                Nomi Portal
              </div>
              {accountEmail ? (
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                  {accountEmail}
                </div>
              ) : null}
              {websiteUnlocked && isDeliveryNew(deliveryDeliveredAt) ? (
                <div className="mt-2 text-[11px] font-medium text-emerald-700">
                  {copy.newBadge}
                </div>
              ) : null}
            </div>

            <nav className="flex-1 px-2 py-2">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewChange(item.id)}
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
              })}
            </nav>

            <div className="border-t p-3">
              <button
                type="button"
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                onClick={() => {
                  const next = locale === "es" ? "en" : "es";
                  localStorage.setItem(PORTAL_LOCALE_KEY, next);
                  onLocaleChange(next);
                }}
              >
                {copy.languageToggle}
              </button>
              {unreadNotifications > 0 ? (
                <div className="mt-2 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {unreadNotifications} {copy.notificationTitle.toLowerCase()}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
};