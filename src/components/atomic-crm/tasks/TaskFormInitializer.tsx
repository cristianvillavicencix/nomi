import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { extractTaskDueTime } from "@/components/atomic-crm/tasks/taskDueDateTime";

/** Hydrate virtual due_time from stored due_date when editing a task. */
export const TaskFormInitializer = () => {
  const { getValues, setValue } = useFormContext();

  useEffect(() => {
    const currentTime = getValues("due_time");
    if (currentTime != null && currentTime !== "") return;

    const dueDate = getValues("due_date");
    const extracted = extractTaskDueTime(
      dueDate == null ? null : String(dueDate),
    );
    if (extracted) {
      setValue("due_time", extracted, { shouldDirty: false });
    }
  }, [getValues, setValue]);

  return null;
};
