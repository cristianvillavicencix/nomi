import { Import, PanelTop, Settings, User } from "lucide-react";
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
import { isLbsMode } from "@/lbs/productMode";
import { LBS_USER_MENU_NAV_ITEMS } from "@/lbs/navigation";

export const CRMUserMenuItems = () => (
  <>
    <ProfileMenu />
    {!isLbsMode() ? (
      <CanAccess resource="configuration" action="edit">
        <SettingsMenu />
      </CanAccess>
    ) : (
      <>
        {LBS_USER_MENU_NAV_ITEMS.map((item) => (
          <CanAccess
            key={item.to}
            resource={item.resource!}
            action={item.action ?? "list"}
          >
            <LbsUserNavMenuItem item={item} />
          </CanAccess>
        ))}
      </>
    )}
    <NavigationLayoutMenu />
    {!isLbsMode() ? (
      <>
        <DropdownMenuSeparator />
        <ImportFromJsonMenuItem />
      </>
    ) : null}
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

const LbsUserNavMenuItem = ({
  item,
}: {
  item: (typeof LBS_USER_MENU_NAV_ITEMS)[number];
}) => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<LbsUserNavMenuItem> must be used inside <UserMenu>");
  }

  const Icon = item.icon;

  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={item.to} className="flex items-center gap-2">
        <Icon className="size-4" />
        {item.label}
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
