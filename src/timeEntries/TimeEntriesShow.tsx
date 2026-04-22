import { Link } from "react-router";
import type { ReactNode } from "react";
import { ShowBase, useCreatePath, useGetOne, useShowContext } from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Deal, Person, TimeEntry } from "@/components/atomic-crm/types";
import { enWeekdayShort } from "./helpers";

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  if (value.length >= 5) return value.slice(0, 5);
  return value;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const plain = value.slice(0, 10);
  const parts = plain.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return value;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return value;
  const w = enWeekdayShort(plain);
  const rest = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${w}, ${rest}`;
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm">{value}</span>
  </div>
);

const TimeEntriesShowContent = () => {
  const { record, isPending } = useShowContext<TimeEntry>();
  const createPath = useCreatePath();

  const { data: person } = useGetOne<Person>(
    "people",
    { id: record?.person_id },
    { enabled: Boolean(record?.person_id) },
  );

  const { data: project } = useGetOne<Deal>(
    "deals",
    { id: record?.project_id },
    { enabled: Boolean(record?.project_id) },
  );

  if (isPending || !record) return null;

  const personName = [person?.first_name, person?.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Time Entry</h1>
        {record.status !== "paid" ? (
          <Button asChild>
            <Link to={createPath({ resource: "time_entries", id: record.id, type: "edit" })}>
              Edit time entry
            </Link>
          </Button>
        ) : (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            Día ya pagado — solo lectura
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Date" value={formatDate(record.date)} />
          <Row label="Employee" value={personName || "—"} />
          <Row label="Project" value={project?.name || "—"} />
          <Row label="Address" value={record.work_location || "—"} />
          <Row label="Start time" value={formatTime(record.start_time)} />
          <Row
            label="Lunch (minutes)"
            value={Number(record.lunch_minutes ?? record.break_minutes ?? 0)}
          />
          <Row label="End time" value={formatTime(record.end_time)} />
          <Row label="Hours" value={Number(record.hours ?? 0).toFixed(2)} />
          <Row label="Payable hours" value={Number(record.payable_hours ?? 0).toFixed(2)} />
          <Row label="Regular hours" value={Number(record.regular_hours ?? 0).toFixed(2)} />
          <Row label="Overtime hours" value={Number(record.overtime_hours ?? 0).toFixed(2)} />
          <Row label="Status" value={record.status} />
          <Row label="Day type" value={record.day_type ?? "—"} />
          <Row label="Notes" value={record.notes || "—"} />
        </CardContent>
      </Card>
    </div>
  );
};

export const TimeEntriesShow = () => (
  <ShowBase resource="time_entries">
    <TimeEntriesShowContent />
  </ShowBase>
);
