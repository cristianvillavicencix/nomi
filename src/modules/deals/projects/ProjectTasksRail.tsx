import { useMemo } from "react";
import { useGetList } from "ra-core";
import { ListChecks, PanelLeftOpen, PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { ProjectTasksPanel } from "@/modules/deals/projects/ProjectTasksPanel";
import type { LbsDeal, Task as TaskRecord } from "@/modules/types";

const RAIL_WIDTH_PX = 360;
const COLLAPSED_RAIL_WIDTH_PX = 40;

const resolveContactIds = (record: LbsDeal): LbsDeal["contact_ids"] => {
  if (record.contact_ids && record.contact_ids.length > 0) {
    return record.contact_ids;
  }
  if (record.contact_id != null) return [record.contact_id];
  return [];
};

const useProjectOpenTaskStats = (dealId: LbsDeal["id"]) => {
  const { data: openTasks = [] } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": dealId, ...TASK_STATUS_FILTERS.open },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  return useMemo(() => computeTaskStats(openTasks), [openTasks]);
};

export const ProjectTasksRail = ({
  record,
  collapsed,
  onToggleCollapsed,
}: {
  record: LbsDeal;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) => {
  const contactIds = useMemo(
    () => resolveContactIds(record),
    [record.contact_id, record.contact_ids],
  );
  const stats = useProjectOpenTaskStats(record.id);

  if (collapsed) {
    return (
      <aside
        className="sticky top-4 flex shrink-0 flex-col items-center self-stretch border-l bg-muted/20 py-3 print:hidden"
        style={{
          width: COLLAPSED_RAIL_WIDTH_PX,
          minHeight: "calc(100vh - 8rem)",
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Show project tasks"
              onClick={onToggleCollapsed}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show tasks</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mt-2 flex flex-col items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={onToggleCollapsed}
              aria-label="Show project tasks"
            >
              <ListChecks className="size-4" />
              {stats.open > 0 ? (
                <span className="text-[10px] font-medium tabular-nums text-foreground">
                  {stats.open}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {stats.open > 0
              ? `${stats.open} open task${stats.open === 1 ? "" : "s"}`
              : "Project tasks"}
            {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ""}
          </TooltipContent>
        </Tooltip>

        <span className="mt-auto rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Tasks
        </span>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-4 flex shrink-0 flex-col self-stretch overflow-hidden border-l bg-background print:hidden",
        "transition-[width] duration-200 ease-out",
      )}
      style={{ width: RAIL_WIDTH_PX, minHeight: "calc(100vh - 8rem)" }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Project tasks</h3>
          {stats.open > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {stats.open} open
            </span>
          ) : null}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onToggleCollapsed}
              aria-label="Collapse tasks panel"
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Collapse panel</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ProjectTasksPanel record={record} contactIds={contactIds} />
      </div>
    </aside>
  );
};

export const ProjectTasksDialog = ({
  record,
  open,
  onOpenChange,
}: {
  record: LbsDeal;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  const contactIds = useMemo(
    () => resolveContactIds(record),
    [record.contact_id, record.contact_ids],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            Project tasks
          </DialogTitle>
          <DialogDescription>
            All tasks linked to this project. Same view as the side panel.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {open ? (
            <ProjectTasksPanel record={record} contactIds={contactIds} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
