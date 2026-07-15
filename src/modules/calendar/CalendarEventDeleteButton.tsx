import { Trash } from "lucide-react";
import { useDelete, useNotify, useRecordContext, useResourceContext } from "ra-core";
import { Button } from "@/components/ui/button";

/**
 * Immediate (pessimistic) delete for calendar event dialogs.
 * The admin DeleteButton uses undoable mode, which is cancelled when the
 * dialog unmounts — so meetings appeared to "not delete".
 */
export const CalendarEventDeleteButton = ({
  onSuccess,
  onError,
  label = "Delete",
}: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  label?: string;
}) => {
  const record = useRecordContext();
  const resource = useResourceContext() ?? "calendar_events";
  const notify = useNotify();
  const [deleteOne, { isPending }] = useDelete();

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      disabled={isPending || record?.id == null}
      className="cursor-pointer border-destructive! text-destructive! hover:bg-destructive/10! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
      onClick={() => {
        if (record?.id == null) return;
        deleteOne(
          resource,
          { id: record.id, previousData: record },
          {
            mutationMode: "pessimistic",
            onSuccess: () => {
              notify("Event deleted", { type: "info" });
              onSuccess?.();
            },
            onError: (error) => {
              onError?.(error);
            },
          },
        );
      }}
    >
      <Trash className="size-4" />
      {label}
    </Button>
  );
};
