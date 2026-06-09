import { Settings, User } from "lucide-react";
import { useUserMenu } from "ra-core";
import { Link } from "react-router";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SettingsPage } from "../settings/SettingsPage";
import { ProfilePage } from "../settings/ProfilePage";

export const CRMUserMenuItems = () => (
  <>
    <SettingsMenu />
    <ProfileMenu />
  </>
);

const SettingsMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={SettingsPage.path} className="flex items-center gap-2">
        <Settings />
        General
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
