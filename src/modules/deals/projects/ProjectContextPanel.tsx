import { useEffect, useMemo, useState } from "react";
import { ListChecks, MessageSquare, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { useGetList } from "ra-core";
import type { LbsDeal, Task as TaskRecord } from "@/modules/types";
import { ProjectTasksPanel } from "@/modules/deals/projects/ProjectTasksPanel";
import { ProjectMessagesPanel } from "@/modules/deals/projects/ProjectMessagesPanel";

type ContextTab = "tasks" | "messages";

const RAIL_WIDTH_PX = 360;
const COLLAPSED_RAIL_WIDTH_PX = 44;

const projectContextAsideClass =
  "flex h-full shrink-0 flex-col overflow-hidden border-l bg-background print:hidden";

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

const ProjectContextTabs = ({
  tabs,
  activeTab,
  onChange,
  onCollapse,
}: {
  tabs: Array<{ id: ContextTab; label: string; icon: typeof ListChecks }>;
  activeTab: ContextTab;
  onChange: (tab: ContextTab) => void;
  onCollapse: () => void;
}) => (
  <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2">
    <div className="flex min-w-0 flex-1 gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {tab.label}
          </button>
        );
      })}
    </div>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Collapse panel"
          onClick={onCollapse}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Collapse panel</TooltipContent>
    </Tooltip>
  </div>
);

const ProjectContextCollapsedRail = ({
  tabs,
  taskCount,
  onOpenTab,
}: {
  tabs: Array<{ id: ContextTab; label: string; icon: typeof ListChecks }>;
  taskCount: number;
  onOpenTab: (tab: ContextTab) => void;
}) => (
  <aside
    className={cn(projectContextAsideClass, "py-3")}
    style={{ width: COLLAPSED_RAIL_WIDTH_PX }}
  >
    <div className="flex flex-1 flex-col items-center gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative size-9"
                aria-label={`Open ${tab.label}`}
                onClick={() => onOpenTab(tab.id)}
              >
                <Icon className="size-4" />
                {tab.id === "tasks" && taskCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-medium tabular-nums">
                    {taskCount > 9 ? "9+" : taskCount}
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{tab.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    <span className="pb-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
      Context
    </span>
  </aside>
);

export const ProjectContextPanel = ({
  record,
  collapsed,
  onToggleCollapsed,
}: {
  record: LbsDeal;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) => {
  const contactIds = useMemo(() => resolveContactIds(record), [record]);
  const stats = useProjectOpenTaskStats(record.id);

  const tabs = useMemo(
    (): Array<{
      id: ContextTab;
      label: string;
      icon: typeof ListChecks;
    }> => [
      { id: "tasks", label: "Tasks", icon: ListChecks },
      { id: "messages", label: "Messages", icon: MessageSquare },
    ],
    [],
  );

  const [activeTab, setActiveTab] = useState<ContextTab>("tasks");

  useEffect(() => {
    setActiveTab((current) =>
      tabs.some((tab) => tab.id === current) ? current : "tasks",
    );
  }, [record.id, tabs]);

  const openTab = (tab: ContextTab) => {
    setActiveTab(tab);
    if (collapsed) onToggleCollapsed();
  };

  if (collapsed) {
    return (
      <ProjectContextCollapsedRail
        tabs={tabs}
        taskCount={stats.open}
        onOpenTab={openTab}
      />
    );
  }

  return (
    <aside
      className={projectContextAsideClass}
      style={{ width: RAIL_WIDTH_PX }}
    >
      <ProjectContextTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        onCollapse={onToggleCollapsed}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "tasks" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <ProjectTasksPanel record={record} contactIds={contactIds} />
          </div>
        ) : null}
        {activeTab === "messages" ? (
          <ProjectMessagesPanel record={record} className="h-full min-h-0 flex-1" />
        ) : null}
      </div>
    </aside>
  );
};
