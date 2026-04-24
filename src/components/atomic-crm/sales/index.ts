import type { Sale } from "../types";
import { RedirectToSettingsUsers } from "./RedirectToSettingsUsers";

export default {
  list: RedirectToSettingsUsers,
  create: RedirectToSettingsUsers,
  edit: RedirectToSettingsUsers,
  recordRepresentation: (record: Sale) =>
    `${record.first_name} ${record.last_name}`,
};
