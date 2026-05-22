import { WebFormsList } from "./WebFormsList";
import { WebFormShow } from "./WebFormShow";
import { WebFormEdit } from "./WebFormEdit";
import { WebFormCreate } from "./WebFormCreate";

export default {
  list: WebFormsList,
  show: WebFormShow,
  edit: WebFormEdit,
  create: WebFormCreate,
  recordRepresentation: (record: { name?: string | null }) => record.name ?? "Web form",
};

export { WebFormsList, WebFormShow, WebFormEdit, WebFormCreate };
