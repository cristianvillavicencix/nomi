import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  SETTINGS_NAV_GROUPS,
  type SettingsTabId,
} from "@/modules/settings/settingsNavigation";

type Props = {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const SettingsHubLayout = ({
  activeTab,
  onTabChange,
  title,
  children,
  footer,
}: Props) => (
  <div className="flex w-full min-w-0">
    <aside
      className={cn(
        "hidden w-56 shrink-0 flex-col border-r bg-muted/15 md:flex",
        "md:sticky md:top-0 md:max-h-[calc(100svh-3.5rem)] md:overflow-y-auto md:self-start",
      )}
    >
      <div className="border-b px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Settings
        </p>
      </div>
      <nav className="flex-1 space-y-5 p-3" aria-label="Settings">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeTab;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b px-4 py-3 md:hidden">
        <label className="sr-only" htmlFor="settings-mobile-tab">
          Settings section
        </label>
        <select
          id="settings-mobile-tab"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={activeTab}
          onChange={(event) =>
            onTabChange(event.target.value as SettingsTabId)
          }
        >
          {SETTINGS_NAV_GROUPS.flatMap((group) =>
            group.items.map((item) => (
              <option key={item.id} value={item.id}>
                {group.label} — {item.label}
              </option>
            )),
          )}
        </select>
      </div>

      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{title}</h1>
        <div className="w-full min-w-0">{children}</div>
      </div>

      {footer ? (
        <div className="sticky bottom-0 shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {footer}
        </div>
      ) : null}
    </div>
  </div>
);
