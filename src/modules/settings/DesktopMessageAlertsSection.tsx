import { Bell } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

export const DesktopMessageAlertsSection = () => (
  <Button type="button" size="sm" variant="outline" asChild>
    <Link
      to={{
        pathname: "/settings",
        search: buildSettingsSearchParams("notifications").toString(),
      }}
    >
      <Bell className="mr-2 size-4" />
      Notification settings
    </Link>
  </Button>
);
