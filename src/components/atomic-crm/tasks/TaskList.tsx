import { List } from "@/components/admin/list";
import { TopToolbar } from "../layout/TopToolbar";
import { ModuleInfoPopover } from "../layout/ModuleInfoPopover";
import { AddTask } from "./AddTask";
import { TasksPageContent } from "./TasksPageContent";

export const TaskList = () => (
  <List title="Tasks" perPage={50} disableBreadcrumb actions={<TaskListActions />}>
    <TasksPageContent />
  </List>
);

const TaskListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <AddTask display="chip" selectContact />
    <ModuleInfoPopover
      title="Tasks"
      description="Track follow-ups and internal work across leads and projects."
    />
  </TopToolbar>
);
