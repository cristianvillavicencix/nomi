import { useRecordContext } from "ra-core";
import {
  CancelButton,
  Edit,
  FormToolbar,
  SimpleForm,
} from "@/components/admin";
import type { TimeEntry } from "@/components/atomic-crm/types";
import { TimeEntriesForm } from "./TimeEntriesForm";

const TimeEntriesEditToolbar = () => {
  const record = useRecordContext<TimeEntry>();
  if (record?.status === "paid") {
    return (
      <FormToolbar>
        <CancelButton />
      </FormToolbar>
    );
  }
  return <FormToolbar />;
};

const TimeEntriesEditFormBody = () => {
  const record = useRecordContext<TimeEntry>();
  const paidLocked = record?.status === "paid";

  return (
    <SimpleForm toolbar={<TimeEntriesEditToolbar />}>
      {paidLocked ? (
        <div className="max-w-none rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/40 md:col-span-2">
          <span className="font-semibold text-amber-900 dark:text-amber-100">
            Día ya pagado
          </span>
          <p className="mt-1 text-muted-foreground">
            Este registro ya está en un pago completado. No se puede editar para evitar pagar dos
            veces el mismo día.
          </p>
        </div>
      ) : null}
      <TimeEntriesForm />
    </SimpleForm>
  );
};

export const TimeEntriesEdit = () => (
  <Edit
    transform={(data) => {
      const { day_state, lunch_minutes, ...rest } = data;
      return rest;
    }}
  >
    <TimeEntriesEditFormBody />
  </Edit>
);
