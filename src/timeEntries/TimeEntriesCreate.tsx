import { useEffect, useRef } from "react";
import { useGetList } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import {
  CancelButton,
  Create,
  FormToolbar,
  SaveButton,
  SimpleForm,
} from "@/components/admin";
import type { TimeEntry } from "@/components/atomic-crm/types";
import { TimeEntriesForm } from "./TimeEntriesForm";

function normalizeDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

function TimeEntriesCreateBody() {
  const { setError, clearErrors } = useFormContext();
  const clashErrorActive = useRef(false);
  const personId = useWatch({ name: "person_id" });
  const dateRaw = useWatch({ name: "date" });
  const dateStr = normalizeDateStr(dateRaw);

  const enabled = Boolean(personId && dateStr);

  const { data: paidEntries = [], isFetching } = useGetList<TimeEntry>(
    "time_entries",
    {
      pagination: { page: 1, perPage: 1 },
      filter: {
        "person_id@eq": personId,
        "date@eq": dateStr,
        "status@eq": "paid",
      },
    },
    { enabled },
  );

  const hasPaidClash = enabled && paidEntries.length > 0;

  useEffect(() => {
    if (hasPaidClash) {
      setError("date", {
        type: "manual",
        message:
          "Ya hay un registro pagado para este empleado en esta fecha. No se puede duplicar.",
      });
      clashErrorActive.current = true;
    } else if (clashErrorActive.current) {
      clearErrors("date");
      clashErrorActive.current = false;
    }
  }, [hasPaidClash, setError, clearErrors]);

  return (
    <>
      <TimeEntriesForm />
      {hasPaidClash ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Ya existe un día pagado para este empleado en esta fecha. Elige otra
          fecha o revisa el registro existente; no se puede volver a registrar
          para evitar un doble pago.
        </div>
      ) : null}
      <FormToolbar>
        <CancelButton />
        <SaveButton disabled={hasPaidClash || (enabled && isFetching)} />
      </FormToolbar>
    </>
  );
}

export const TimeEntriesCreate = () => (
  <Create
    transform={(data) => {
      const { day_state, lunch_minutes, ...rest } = data;
      return rest;
    }}
  >
    <SimpleForm toolbar={null} defaultValues={{ org_id: 1, status: "draft" }}>
      <TimeEntriesCreateBody />
    </SimpleForm>
  </Create>
);
