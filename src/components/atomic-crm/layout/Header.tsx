import { useGetIdentity } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";

import { canAccess } from "../providers/commons/canAccess";
import { hasMemberCapability } from "../providers/commons/memberModuleAccess";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CRMUserMenuItems } from "./UserMenuItems";
import { LBS_NAV_ITEMS, filterLbsNavItems } from "@/lbs/navigation";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const { data: identity } = useGetIdentity();
  const { enabled: websiteMonitorEnabled } = useWebsiteMonitorEnabled(true);
  const lbsNavItems = filterLbsNavItems(LBS_NAV_ITEMS, {
    websiteMonitorEnabled,
  });

  return (
    <header className="bg-secondary">
      <div className="px-4">
        <div className="flex justify-between items-center flex-1">
          <Link
            to="/"
            className="flex items-center gap-2 text-secondary-foreground no-underline"
          >
            <img
              className="[.light_&]:hidden h-6"
              src={darkModeLogo}
              alt={title}
            />
            <img
              className="[.dark_&]:hidden h-6"
              src={lightModeLogo}
              alt={title}
            />
            <h1 className="text-xl font-semibold">{title}</h1>
          </Link>
          <nav className="flex flex-wrap">
            {lbsNavItems
              .filter((item) =>
                item.capability
                  ? hasMemberCapability(identity as any, item.capability)
                  : item.resource
                    ? canAccess(identity as any, {
                        resource: item.resource,
                        action: item.action ?? "list",
                      })
                    : true,
              )
              .map((item) => {
                const isActive =
                  item.activePattern === "/"
                    ? location.pathname === "/"
                    : !!matchPath(item.activePattern, location.pathname);
                return (
                  <NavigationTab
                    key={item.to}
                    label={item.label}
                    to={item.to}
                    isActive={isActive}
                  />
                );
              })}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeModeToggle />
            <RefreshButton />
            <UserMenu>
              <CRMUserMenuItems />
            </UserMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
  </Link>
);

export default Header;
