import { isAfter } from "date-fns";
import { useListContext } from "ra-core";

import { Task } from "./Task";

import { isLbsMode } from "@/lbs/productMode";

export const TasksIterator = ({
  showContact,
  showDeal,
  showAssignee = true,
  className,
}: {
  showContact?: boolean;
  showDeal?: boolean;
  showAssignee?: boolean;
  className?: string;
}) => {
  const { data, error, isPending } = useListContext();
  if (isPending || error || data.length === 0) return null;

  // Keep only tasks that are not done or done less than 5 minutes ago
  const tasks = data.filter(
    (task) =>
      !task.done_date ||
      isAfter(new Date(task.done_date), new Date(Date.now() - 5 * 60 * 1000)),
  );

  return (
    <div className={`space-y-4 md:space-y-2 ${className || ""}`}>
      {tasks.map((task) => (
        <Task
          task={task}
          showContact={showContact}
          showDeal={showDeal ?? isLbsMode()}
          showAssignee={showAssignee}
          key={task.id}
        />
      ))}
    </div>
  );
};
