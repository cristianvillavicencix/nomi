import { useGetList } from "ra-core";
import type { DealResource, LbsDeal, Task } from "@/lbs/types";
import { getLbsProjectStageLabel } from "@/lbs/deals/lbsProjectConstants";

export const ProjectActivityTab = ({ record }: { record: LbsDeal }) => {
  const { data: tasks = [] } = useGetList<Task>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: resources = [] } = useGetList<DealResource>(
    "deal_resources",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const events = [
    {
      id: "stage",
      label: `Stage: ${getLbsProjectStageLabel(record.stage)}`,
      at: record.updated_at,
    },
    ...resources.map((r) => ({
      id: `resource-${r.id}`,
      label: `Asset uploaded: ${r.file?.title ?? r.category}`,
      at: r.created_at,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      label: t.done_date ? `Task completed: ${t.text}` : `Task: ${t.text}`,
      at: t.done_date ?? t.due_date ?? t.created_at,
    })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <ul className="space-y-3">
      {events.length === 0 ? (
        <li className="text-sm text-muted-foreground">No activity yet.</li>
      ) : (
        events.map((event) => (
          <li key={event.id} className="rounded-lg border px-4 py-3 text-sm">
            <div>{event.label}</div>
            <div className="text-xs text-muted-foreground">
              {event.at ? new Date(String(event.at)).toLocaleString() : ""}
            </div>
          </li>
        ))
      )}
    </ul>
  );
};
