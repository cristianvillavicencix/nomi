import { useMemo } from "react";
import { useGetList, useListFilterContext } from "ra-core";
import type { Person, TimeEntry } from "@/components/atomic-crm/types";
import { calculateCompensationGross } from "@/payroll/rules";
import { splitEntryHours } from "./pendingPayrollEntryHours";

export type PayrollPendingQueueRow = {
  personId: number;
  name: string;
  from: string;
  to: string;
  regular: number;
  overtime: number;
  paidLeave: number;
  estimatedGross: number;
};

export const usePayrollPendingQueueRows = () => {
  const { filterValues } = useListFilterContext();
  const selectedEmployeeId =
    filterValues.employee_id == null || filterValues.employee_id === ""
      ? null
      : Number(filterValues.employee_id);

  const { data: entriesRaw = [], isPending: entriesLoading } =
    useGetList<TimeEntry>(
      "time_entries",
      {
        pagination: { page: 1, perPage: 20000 },
        sort: { field: "date", order: "ASC" },
        filter: {
          status: "approved",
          "payroll_run_id@is": null,
        },
      },
      { staleTime: 15_000 },
    );

  const entries = useMemo(
    () =>
      entriesRaw.filter(
        (e) =>
          e.status === "approved" &&
          (e.payroll_run_id == null || e.payroll_run_id === ""),
      ),
    [entriesRaw],
  );

  const { data: people = [], isPending: peopleLoading } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 4000 },
      sort: { field: "first_name", order: "ASC" },
      filter: { status: "active" },
    },
    { staleTime: 30_000 },
  );

  const peopleById = useMemo(
    () =>
      people.reduce<Record<string, Person>>((acc, p) => {
        acc[String(p.id)] = p;
        return acc;
      }, {}),
    [people],
  );

  const rows = useMemo(() => {
    const byPerson = new Map<
      number,
      {
        personId: number;
        dates: string[];
        regular: number;
        overtime: number;
        paidLeave: number;
      }
    >();

    for (const entry of entries) {
      const pid = Number(entry.person_id);
      if (!Number.isFinite(pid)) continue;
      if (selectedEmployeeId != null && pid !== selectedEmployeeId) continue;

      const { regular, overtime, paidLeave } = splitEntryHours(entry);
      const cur = byPerson.get(pid) ?? {
        personId: pid,
        dates: [] as string[],
        regular: 0,
        overtime: 0,
        paidLeave: 0,
      };
      cur.dates.push(entry.date);
      cur.regular += regular;
      cur.overtime += overtime;
      cur.paidLeave += paidLeave;
      byPerson.set(pid, cur);
    }

    const list: PayrollPendingQueueRow[] = [...byPerson.values()].map((agg) => {
      const dates = [...agg.dates].sort();
      const from = dates[0] ?? "";
      const to = dates[dates.length - 1] ?? "";
      const person = peopleById[String(agg.personId)];
      const { grossPay } = person
        ? calculateCompensationGross({
            person,
            regularHours: agg.regular,
            overtimeHours: agg.overtime,
            paidLeaveHours: agg.paidLeave,
            payPeriodStart: from,
            payPeriodEnd: to,
          })
        : { grossPay: 0 };

      const name = person
        ? `${person.first_name} ${person.last_name}`.trim()
        : `Person #${agg.personId}`;

      return {
        personId: agg.personId,
        name,
        from,
        to,
        regular: agg.regular,
        overtime: agg.overtime,
        paidLeave: agg.paidLeave,
        estimatedGross: grossPay,
      };
    });

    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [entries, peopleById, selectedEmployeeId]);

  const loading = entriesLoading || peopleLoading;

  return { rows, loading };
};
