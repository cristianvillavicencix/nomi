import { List } from "@/components/admin/list";
import { PageActions, PageTitle } from "../layout/PageActions";
import { TasksPageContent } from "./TasksPageContent";

export const TaskList = () => (
  <List
    title={false}
    perPage={50}
    disableBreadcrumb
    pagination={false}
    actions={
      <PageActions>
        <PageTitle label="Calendar" />
      </PageActions>
    }
  >
    <TasksPageContent />
  </List>
);
