import { useEffect, useState } from "react";
import type { Identifier } from "ra-core";
import { EditBase, Form, useGetList, useNotify, useRefresh } from "ra-core";
import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { SaveButton } from "@/components/admin/form";
import { TimeEntriesForm } from "@/timeEntries/TimeEntriesForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeEntry } from "@/components/atomic-crm/types";
import { splitPendingPayrollEntryHours } from "./pendingPayrollEntryHours";

export type PayrollReviewTarget = {
  personId: number;
  name: string;
};

const formatDayType = (entry: TimeEntry) => {
  const t = String(entry.day_type ?? "worked_day");
  return t.replace(/_/g, " ");
};

const timeEntryEditTransform = (data: Record<string, unknown>) => {
  const { day_state, lunch_minutes, ...rest } = data;
  return rest;
};

function TimeEntryPayrollEditDialog({
  entryId,
  open,
  onOpenChange,
}: {
  entryId: Identifier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notify = useNotify();
  const refresh = useRefresh();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {entryId != null ? (
        <EditBase
          key={String(entryId)}
          resource="time_entries"
          id={entryId}
          redirect={false}
          transform={timeEntryEditTransform}
          mutationOptions={{
            onSuccess: () => {
              notify("Time entry saved", { type: "success" });
              refresh();
              onOpenChange(false);
            },
          }}
        >
          <DialogContent className="top-[6%] z-[100] max-h-[90vh] max-w-[calc(100%-2rem)] translate-y-0 overflow-y-auto sm:max-w-2xl">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Editar registro de horas</DialogTitle>
                <DialogDescription>
                  Los cambios se guardan en Hours. Al guardar, esta ventana se
                  cierra y se actualiza la lista de revisión.
                </DialogDescription>
              </DialogHeader>
              <TimeEntriesForm />
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <SaveButton label="Guardar" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      ) : null}
    </Dialog>
  );
}

export function PayrollApprovedHoursReviewDialog({
  target,
  onOpenChange,
}: {
  target: PayrollReviewTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target != null;
  const personId = target?.personId;
  const personName = target?.name ?? "";

  const [editEntryId, setEditEntryId] = useState<Identifier | null>(null);

  useEffect(() => {
    if (target == null) setEditEntryId(null);
  }, [target]);

  const { data: entries = [], isPending: entriesLoading } =
    useGetList<TimeEntry>(
      "time_entries",
      {
        pagination: { page: 1, perPage: 5000 },
        sort: { field: "date", order: "ASC" },
        filter: {
          person_id: personId ?? 0,
          status: "approved",
          "payroll_run_id@is": null,
        },
      },
      { enabled: open && personId != null, staleTime: 10_000 },
    );

  const payrollHref =
    personId != null
      ? `/payroll_runs/create?employee_id=${personId}`
      : "/payroll_runs/create";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] max-w-[calc(100%-2rem)] flex-col gap-0 p-0 sm:max-w-3xl">
          <div className="border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle>Horas listas para nómina — {personName}</DialogTitle>
              <DialogDescription>
                Entradas aprobadas que aún no están en una corrida. Aquí solo
                revisas y corriges. El dinero no sale de esta app:{" "}
                <strong>crea la corrida</strong> y, cuando esté aprobada,{" "}
                <strong>registra el pago</strong> en la pestaña Payments para
                cerrar el lote y dejar constancia de que ya pagaste al personal.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
            {entriesLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay líneas pendientes para esta persona. Puede que ya se
                hayan movido a una corrida.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo día</TableHead>
                    <TableHead className="text-right">
                      Reg / OT / Baja
                    </TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="w-[7rem] text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const { regular, overtime, paidLeave } =
                      splitPendingPayrollEntryHours(entry);
                    return (
                      <TableRow key={String(entry.id)}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {entry.date}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {formatDayType(entry)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {regular.toFixed(2)} / {overtime.toFixed(2)} /{" "}
                          {paidLeave.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {Number(entry.hours ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setEditEntryId(entry.id)}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {!entriesLoading &&
            entries.some((e) => Boolean(e.internal_notes?.trim())) ? (
              <Alert className="mt-4 border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Hay líneas con <strong>notas internas</strong> — revísalas
                  antes de crear la corrida.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-3 border-t px-6 py-4 sm:items-stretch sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild className="w-full sm:w-auto">
                <Link to={payrollHref} onClick={() => onOpenChange(false)}>
                  Crear corrida de nómina
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </div>
            <p className="text-center text-[11px] leading-snug text-muted-foreground sm:text-left">
              <strong>Registrar el pago</strong> (cerrar horas y dejar
              constancia de que ya pagaste) va en la pestaña{" "}
              <strong>Payments</strong>, enlazada a la corrida cuando esté
              aprobada — no sustituye al banco.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TimeEntryPayrollEditDialog
        entryId={editEntryId}
        open={editEntryId != null}
        onOpenChange={(next) => {
          if (!next) setEditEntryId(null);
        }}
      />
    </>
  );
}
