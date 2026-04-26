import type { OrganizationMember } from "../types";
import { RedirectToSettingsUsers } from "./RedirectToSettingsUsers";

export default {
  list: RedirectToSettingsUsers,
  create: RedirectToSettingsUsers,
  edit: RedirectToSettingsUsers,
  recordRepresentation: (record: OrganizationMember) =>
    `${record.first_name} ${record.last_name}`,
};
