import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

/** Deep-link to Settings → Connectors → Mailboxes. */
export const mailboxesSettingsPath = () => ({
  pathname: "/settings",
  search: buildSettingsSearchParams("connectors", "mailboxes").toString(),
});
