import { Printer } from "lucide-react";
import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { useCreatePath, useNotify, useResourceContext, useSaveContext } from "ra-core";
import { CancelButton, FormToolbar, SaveButton } from "@/components/admin";
import { Button } from "@/components/ui/button";

export const LoansToolbar = ({
  transform,
  showPrint = true,
}: {
  transform: (data: Record<string, unknown>) => Record<string, unknown>;
  showPrint?: boolean;
}) => {
  const form = useFormContext();
  const saveContext = useSaveContext();
  const resource = useResourceContext();
  const notify = useNotify();
  const createPath = useCreatePath();

  const openPrintView = useCallback(
    (id: unknown) => {
      if (!resource || id == null) return false;
      const showPath = createPath({
        resource,
        id,
        type: "show",
      });
      window.location.assign(`${showPath}?print=1`);
      return true;
    },
    [createPath, resource],
  );

  const getIdFromResponse = useCallback((data: any) => {
    if (data?.id != null) return data.id;
    if (data?.data?.id != null) return data.data.id;
    if (Array.isArray(data?.data) && data.data[0]?.id != null) return data.data[0].id;
    return null;
  }, []);

  const handlePrint = useCallback(async () => {
    if (!saveContext?.save) return;

    return form.handleSubmit(async (values) => {
      let printed = false;
      await saveContext.save?.(values, {
        transform,
        mutationOptions: {
          onSuccess: (data: any) => {
            const savedId = getIdFromResponse(data) ?? form.getValues("id");
            if (openPrintView(savedId)) {
              printed = true;
              notify("Saved. Opening printable detail view.");
              return;
            }
            notify("Saved, but I could not open the print view automatically.", {
              type: "warning",
            });
          },
          onError: () => {
            notify("Could not save the loan. Please review the required fields.", {
              type: "error",
            });
          },
        },
      });
      if (!printed) {
        const currentId = form.getValues("id");
        if (openPrintView(currentId)) {
          notify("Opening printable detail view.");
        }
      }
    }, () => {
      notify("Complete required fields before printing.", {
        type: "warning",
      });
    })();
  }, [form, getIdFromResponse, notify, openPrintView, saveContext, transform]);

  return (
    <FormToolbar>
      <div className="flex flex-row justify-end gap-2">
        <CancelButton />
        {showPrint ? (
          <Button type="button" variant="outline" onClick={() => void handlePrint()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        ) : null}
        <SaveButton />
      </div>
    </FormToolbar>
  );
};
