import { LayoutPanelLeft, LayoutPanelTop, Settings, User } from "lucide-react";
import { useCanAccess, useUserMenu } from "ra-core";
import { Link } from "react-router";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SettingsPage } from "../settings/SettingsPage";
import { ProfilePage } from "../settings/ProfilePage";
import { useNavigationLayoutPreference } from "./navigationLayoutPreference";

export const CRMUserMenuItems = () => (
  <>
    <SettingsMenu />
    <ProfileMenu />
    <NavigationLayoutMenu />
  </>
);

const SettingsMenu = () => {
  const userMenuContext = useUserMenu();
  const { canAccess: canEditSettings, isPending: settingsPending } =
    useCanAccess({ resource: "configuration", action: "edit" });
  const { canAccess: canManageUsers, isPending: usersPending } = useCanAccess({
    resource: "organization_members",
    action: "edit",
  });

  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }

  if (settingsPending || usersPending) {
    return null;
  }

  if (!canEditSettings && !canManageUsers) {
    return null;
  }

  const settingsPath = canEditSettings
    ? SettingsPage.path
    : `${SettingsPage.path}?tab=users`;

  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={settingsPath} className="flex items-center gap-2">
        <Settings />
        Settings
      </Link>
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ProfilePage.path} className="flex items-center gap-2">
        <User />
        Profile
      </Link>
    </DropdownMenuItem>
  );
};

const NavigationLayoutMenu = () => {
  const userMenuContext = useUserMenu();
  const [mode, setMode] = useNavigationLayoutPreference();

  if (!userMenuContext) {
    throw new Error("<NavigationLayoutMenu> must be used inside <UserMenu>");
  }

  const isSidebar = mode === "sidebar";

  return (
    <DropdownMenuItem
      onClick={() => {
        setMode(isSidebar ? "top" : "sidebar");
        userMenuContext.onClose();
      }}
      className="gap-2"
    >
      {isSidebar ? (
        <>
          <LayoutPanelTop />
          Top navigation
        </>
      ) : (
        <>
          <LayoutPanelLeft />
          Sidebar navigation
        </>
      )}
    </DropdownMenuItem>
  );
};
