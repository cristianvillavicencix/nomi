import { List } from "@/components/admin/list";
import { PageActions } from "../layout/PageActions";
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
    <h1 className="mr-2 text-sm font-semibold">Tasks</h1>
    <div className="ml-auto flex items-center gap-2">
      <AddTask display="chip" selectContact />
      <ModuleInfoPopover
        title="Tasks"
        description="Track follow-ups and internal work across leads and projects."
      />
    </div>
  </PageActions>
);
