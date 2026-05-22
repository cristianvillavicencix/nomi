import { endOfWeek, startOfToday } from "date-fns";
import type { Task } from "@/components/atomic-crm/types";

const todayStart = () => startOfToday().getTime();
const weekEnd = () => endOfWeek(new Date(), { weekStartsOn: 0 }).getTime();

export const isTaskOverdue = (task: Task) => {
  if (task.done_date) return false;
  return new Date(task.due_date).getTime() < todayStart();
};

export const isTaskDueThisWeek = (task: Task) => {
  if (task.done_date) return false;
  const due = new Date(task.due_date).getTime();
  return due >= todayStart() && due <= weekEnd();
};

export type TaskStats = {
  open: number;
  overdue: number;
  dueThisWeek: number;
};

export const computeTaskStats = (tasks: Task[]): TaskStats => {
  const openTasks = tasks.filter((task) => !task.done_date);
  return {
    open: openTasks.length,
    overdue: openTasks.filter(isTaskOverdue).length,
    dueThisWeek: openTasks.filter(isTaskDueThisWeek).length,
  };
};
