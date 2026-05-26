import { List } from "@/components/admin/list";
import { PageActions, PageTitle } from "../layout/PageActions";
import { ModuleInfoPopover } from "../layout/ModuleInfoPopover";
import { AddTask } from "./AddTask";
import { TasksPageContent } from "./TasksPageContent";

export const TaskList = () => (
  <List
    title={false}
    perPage={50}
    disableBreadcrumb
    actions={<TaskListActions />}
  >
    <TasksPageContent />
  </List>
);

const TaskListActions = () => (
  <PageActions>
    <PageTitle label="Tasks" />
    <div className="ml-auto flex items-center gap-2">
      <AddTask display="chip" selectContact />
      <ModuleInfoPopover
        title="Tasks"
        description="Track follow-ups and internal work across leads and projects."
      />
    </div>
  </PageActions>
);
