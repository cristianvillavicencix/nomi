import { OrganizationMessageTemplatesSection } from "@/modules/settings/OrganizationMessageTemplatesSection";
import { OrganizationSignatureSection } from "@/modules/settings/OrganizationSignatureSection";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import type { CommunicationsSectionId } from "@/modules/settings/settingsNavigation";

type Props = {
  activeSection: CommunicationsSectionId;
  onSectionChange: (section: CommunicationsSectionId) => void;
};

export const CommunicationsSettingsSection = ({
  activeSection,
  onSectionChange,
}: Props) => (
  <SettingsSubNav
    value={activeSection}
    onValueChange={onSectionChange}
    items={[
      { id: "templates", label: "Message templates" },
      { id: "signature", label: "SMS signature" },
    ]}
    content={
      activeSection === "templates" ? (
        <OrganizationMessageTemplatesSection />
      ) : (
        <OrganizationSignatureSection />
      )
    }
  />
);
