import { List } from "@/components/admin/list";
import { PageActions, PageTitle } from "../layout/PageActions";
import { ModuleInfoPopover } from "../layout/ModuleInfoPopover";
import { TasksPageContent } from "./TasksPageContent";

export const TaskList = () => (
  <List
    title={false}
    perPage={50}
    disableBreadcrumb
    pagination={false}
    actions={<TaskListActions />}
  >
    <TasksPageContent />
  </List>
);

const TaskListActions = () => (
  <PageActions>
    <PageTitle label="Calendar" />
    <div className="ml-auto flex items-center gap-2">
      <ModuleInfoPopover
        title="Calendar"
        description="Tasks, meetings, deliveries, and reminders in one calendar."
      />
    </div>
  </PageActions>
);
