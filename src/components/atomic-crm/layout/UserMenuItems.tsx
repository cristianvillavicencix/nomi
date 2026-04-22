import { Import, PanelTop, Settings, User, Users } from "lucide-react";
import { CanAccess, useUserMenu } from "ra-core";
import { Link } from "react-router";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { ImportPage } from "../misc/ImportPage";
import { useNavigationLayoutPreference } from "./navigationLayoutPreference";

export const CRMUserMenuItems = () => (
  <>
    <ProfileMenu />
    <CanAccess resource="sales" action="list">
      <UsersMenu />
    </CanAccess>
    <CanAccess resource="configuration" action="edit">
      <SettingsMenu />
    </CanAccess>
    <NavigationLayoutMenu />
    <DropdownMenuSeparator />
    <ImportFromJsonMenuItem />
  </>
);

const NavigationLayoutMenu = () => {
  const userMenuContext = useUserMenu();
  const [layoutMode, setLayoutMode] = useNavigationLayoutPreference();

  if (!userMenuContext) {
    throw new Error("<NavigationLayoutMenu> must be used inside <UserMenu>");
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <PanelTop />
        Navigation layout
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={layoutMode}
          onValueChange={(value) => {
            if (value === "top" || value === "sidebar") {
              setLayoutMode(value);
            }
            userMenuContext.onClose();
          }}
        >
          <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="sidebar">Sidebar</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

const UsersMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <Users /> Users
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
      <Link to="/profile" className="flex items-center gap-2">
        <User />
        Profile
      </Link>
    </DropdownMenuItem>
  );
};

const SettingsMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings /> Settings
      </Link>
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Import /> Import data
      </Link>
    </DropdownMenuItem>
  );
};
