import { PersonalDesktopNotificationsPanel } from "@/modules/notifications/settings/PersonalDesktopNotificationsPanel";
import { PersonalSmsPhonePanel } from "@/modules/notifications/settings/PersonalSmsPhonePanel";
import { WorkspaceFormNotificationsPanel } from "@/modules/notifications/settings/WorkspaceFormNotificationsPanel";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import type { NotificationsSectionId } from "@/modules/settings/settingsNavigation";

type Props = {
  activeSection: NotificationsSectionId;
  onSectionChange: (section: NotificationsSectionId) => void;
};

export const NotificationsSettingsSection = ({
  activeSection,
  onSectionChange,
}: Props) => (
  <SettingsSubNav
    value={activeSection}
    onValueChange={onSectionChange}
    items={[
      { id: "personal", label: "Personal" },
      { id: "workspace", label: "Workspace" },
    ]}
    content={
      activeSection === "personal" ? (
        <div className="space-y-8">
          <PersonalSmsPhonePanel />
          <PersonalDesktopNotificationsPanel />
        </div>
      ) : (
        <WorkspaceFormNotificationsPanel />
      )
    }
  />
);
