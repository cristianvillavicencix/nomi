import { useMemo, useState } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal, MaintenanceHoursLog, MaintenanceRetainer } from "@/lbs/types";

const currentBillingPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

export const MaintenanceTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canEdit = useMemberCapability("deal_financials.expenses.edit");
  const [hoursForm, setHoursForm] = useState({ hours: "", description: "" });
  const [create] = useCreate();
  const [update] = useUpdate();

  const { data: retainers = [] } = useGetList<MaintenanceRetainer>(
    "maintenance_retainers",
    {
      filter: { "deal_id@eq": record.id, "active@eq": true },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "id", order: "DESC" },
    },
  );

  const retainer = retainers[0];

  const { data: hoursLog = [] } = useGetList<MaintenanceHoursLog>(
    "maintenance_hours_log",
    {
      filter: retainer
        ? {
            "retainer_id@eq": retainer.id,
            "billing_period@eq": currentBillingPeriod(),
          }
        : { id: -1 },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "worked_date", order: "DESC" },
    },
    { enabled: !!retainer },
  );

  const hoursUsed = useMemo(
    () =>
      hoursLog.reduce(
        (sum, entry) => sum + Number(entry.hours_worked ?? 0),
        0,
      ),
    [hoursLog],
  );

  const handleCreateRetainer = () => {
    if (!record.org_id) return;
    create(
      "maintenance_retainers",
      {
        data: {
          org_id: record.org_id,
          deal_id: record.id,
          monthly_hours_included: 10,
          monthly_amount: 500,
          billing_day: 1,
          start_date: new Date().toISOString().slice(0, 10),
          active: true,
        },
      },
      {
        onSuccess: () => {
          refresh();
          notify("Maintenance retainer created", { type: "info" });
        },
        onError: () => notify("Could not create retainer", { type: "error" }),
      },
    );
  };

  const handleLogHours = () => {
    if (!retainer?.org_id) return;
    const hours = Number(hoursForm.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      notify("Enter valid hours", { type: "warning" });
      return;
    }
    if (!hoursForm.description.trim()) {
      notify("Description is required", { type: "warning" });
      return;
    }
    create(
      "maintenance_hours_log",
      {
        data: {
          org_id: retainer.org_id,
          retainer_id: retainer.id,
          hours_worked: hours,
          description: hoursForm.description.trim(),
          worked_date: new Date().toISOString().slice(0, 10),
          billing_period: currentBillingPeriod(),
        },
      },
      {
        onSuccess: () => {
          setHoursForm({ hours: "", description: "" });
          refresh();
          notify("Hours logged", { type: "info" });
        },
        onError: () => notify("Could not log hours", { type: "error" }),
      },
    );
  };

  if (!retainer) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No active maintenance retainer for this project.
        </p>
        {canEdit ? (
          <Button type="button" className="mt-4" onClick={handleCreateRetainer}>
            Start retainer
          </Button>
        ) : null}
      </div>
    );
  }

  const included = Number(retainer.monthly_hours_included ?? 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">This month</div>
        <div className="mt-1 text-2xl font-semibold">
          {hoursUsed.toFixed(1)} / {included.toFixed(1)} hours
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Retainer: <MoneyText value={Number(retainer.monthly_amount ?? 0)} /> ·
          Billing day {retainer.billing_day}
        </div>
      </div>

      {canEdit ? (
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
          <Input
            type="number"
            min="0"
            step="0.25"
            placeholder="Hours"
            value={hoursForm.hours}
            onChange={(event) =>
              setHoursForm((prev) => ({ ...prev, hours: event.target.value }))
            }
          />
          <Input
            placeholder="What did you work on?"
            value={hoursForm.description}
            onChange={(event) =>
              setHoursForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
          <Button type="button" onClick={handleLogHours}>
            Log hours
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {hoursLog.map((entry) => (
          <div key={entry.id} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">
              {Number(entry.hours_worked).toFixed(2)} h · {entry.description}
            </div>
            <div className="text-muted-foreground">
              {entry.worked_date
                ? new Date(`${entry.worked_date}T12:00:00`).toLocaleDateString()
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
