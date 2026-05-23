import { useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { DealMilestone, LbsDeal } from "@/lbs/types";

const emptyForm = () => ({
  title: "",
  start_date: "",
  due_date: "",
  description: "",
});

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProjectScheduleTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [form, setForm] = useState(emptyForm);
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  const { data: milestones = [], isPending } = useGetList<DealMilestone>(
    "deal_milestones",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "order_index", order: "ASC" },
    },
  );

  const timelineBounds = useMemo(() => {
    const dates = milestones.flatMap((item) =>
      [item.start_date, item.due_date].filter(Boolean),
    ) as string[];
    if (dates.length === 0) return null;
    const sorted = [...dates].sort();
    const start = new Date(`${sorted[0]}T12:00:00`).getTime();
    const end = new Date(`${sorted[sorted.length - 1]}T12:00:00`).getTime();
    const span = Math.max(end - start, 24 * 60 * 60 * 1000);
    return { start, span };
  }, [milestones]);

  const handleCreate = () => {
    if (!form.title.trim()) {
      notify("Title is required", { type: "warning" });
      return;
    }
    if (!record.org_id) return;
    create(
      "deal_milestones",
      {
        data: {
          org_id: record.org_id,
          deal_id: record.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          start_date: form.start_date || null,
          due_date: form.due_date || null,
          order_index: milestones.length + 1,
          color: "#3b82f6",
        },
      },
      {
        onSuccess: () => {
          setForm(emptyForm());
          refresh();
          notify("Milestone added", { type: "info" });
        },
        onError: () => notify("Could not add milestone", { type: "error" }),
      },
    );
  };

  const toggleComplete = (milestone: DealMilestone) => {
    update(
      "deal_milestones",
      {
        id: milestone.id,
        data: {
          completed_at: milestone.completed_at
            ? null
            : new Date().toISOString(),
        },
        previousData: milestone,
      },
      { onSuccess: () => refresh() },
    );
  };

  const handleDelete = (milestone: DealMilestone) => {
    deleteOne(
      "deal_milestones",
      { id: milestone.id, previousData: milestone },
      {
        onSuccess: () => {
          refresh();
          notify("Milestone removed", { type: "info" });
        },
      },
    );
  };

  const barStyle = (milestone: DealMilestone) => {
    if (!timelineBounds || !milestone.due_date) {
      return { left: "0%", width: "100%" };
    }
    const startDate = milestone.start_date || milestone.due_date;
    const left =
      ((new Date(`${startDate}T12:00:00`).getTime() - timelineBounds.start) /
        timelineBounds.span) *
      100;
    const width =
      ((new Date(`${milestone.due_date}T12:00:00`).getTime() -
        new Date(`${startDate}T12:00:00`).getTime()) /
        timelineBounds.span) *
      100;
    return {
      left: `${Math.max(0, Math.min(left, 100))}%`,
      width: `${Math.max(8, Math.min(width, 100 - left))}%`,
    };
  };

  if (isPending) {
    return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 text-sm">
        <div className="text-muted-foreground">Target launch</div>
        <div className="font-medium">
          {record.expected_end_date
            ? formatDate(record.expected_end_date)
            : "Not set — update in Settings"}
        </div>
      </div>

      {canEdit ? (
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="Milestone title"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.start_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, start_date: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.due_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, due_date: event.target.value }))
            }
          />
          <Button type="button" onClick={handleCreate}>
            Add milestone
          </Button>
        </div>
      ) : null}

      {milestones.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No milestones yet. Add key dates for design, development, review, and
          launch.
        </div>
      ) : (
        <div className="space-y-4">
          {timelineBounds ? (
            <div className="relative h-24 rounded-lg border bg-muted/30">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md px-2 text-xs font-medium text-white shadow-sm"
                  style={{
                    ...barStyle(milestone),
                    backgroundColor: milestone.color || "#3b82f6",
                    opacity: milestone.completed_at ? 0.55 : 1,
                  }}
                  title={milestone.title}
                >
                  <span className="block truncate pt-2">{milestone.title}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="font-medium">{milestone.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(milestone.start_date)} →{" "}
                    {formatDate(milestone.due_date)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleComplete(milestone)}
                      >
                        {milestone.completed_at ? "Reopen" : "Complete"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(milestone)}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
