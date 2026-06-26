import { useEffect, useMemo, useState } from "react";
import { ListChecks, MessageSquare, PanelRightClose, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { useGetList, useGetOne } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { LbsDeal, Task as TaskRecord } from "@/modules/types";
import {
  contactHasSmsPhone,
} from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { ProjectTasksPanel } from "@/modules/deals/projects/ProjectTasksPanel";
import { ProjectClientSmsPanel } from "@/modules/deals/projects/ProjectClientSmsPanel";
import { ProjectTeamChat } from "@/modules/messages/ProjectTeamChat";

type ContextTab = "tasks" | "sms" | "team";

const RAIL_WIDTH_PX = 360;
const COLLAPSED_RAIL_WIDTH_PX = 44;

const resolveContactIds = (record: LbsDeal): LbsDeal["contact_ids"] => {
  if (record.contact_ids && record.contact_ids.length > 0) {
    return record.contact_ids;
  }
  if (record.contact_id != null) return [record.contact_id];
  return [];
};

const resolveMainContactId = (record: LbsDeal) => {
  if (record.contact_id != null) return Number(record.contact_id);
  if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
    return Number(record.contact_ids[0]);
  }
  return null;
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
    className="sticky top-4 flex shrink-0 flex-col items-center self-stretch border-l bg-background py-3 print:hidden"
    style={{
      width: COLLAPSED_RAIL_WIDTH_PX,
      minHeight: "calc(100vh - 8rem)",
    }}
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
  const { smsEnabled } = useMessagingEnabled();
  const canSendMessages = useMemberCapability("messaging.send");
  const contactId = resolveMainContactId(record);
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: contactId != null },
  );
  const contactIds = useMemo(() => resolveContactIds(record), [record]);
  const stats = useProjectOpenTaskStats(record.id);

  const showSmsTab =
    smsEnabled &&
    Boolean(contact && contactHasSmsPhone(contact) && canSendMessages);

  const tabs = useMemo(() => {
    const next: Array<{
      id: ContextTab;
      label: string;
      icon: typeof ListChecks;
    }> = [
      { id: "tasks", label: "Tasks", icon: ListChecks },
      { id: "team", label: "Team", icon: Users },
    ];
    if (showSmsTab) {
      next.splice(1, 0, { id: "sms", label: "SMS", icon: MessageSquare });
    }
    return next;
  }, [showSmsTab]);

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
      className="sticky top-4 flex shrink-0 flex-col self-stretch overflow-hidden border-l bg-background print:hidden"
      style={{ width: RAIL_WIDTH_PX, minHeight: "calc(100vh - 8rem)" }}
    >
      <ProjectContextTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        onCollapse={onToggleCollapsed}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "tasks" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ProjectTasksPanel record={record} contactIds={contactIds} />
          </div>
        ) : null}
        {activeTab === "sms" && showSmsTab ? (
          <ProjectClientSmsPanel record={record} className="min-h-0 flex-1" />
        ) : null}
        {activeTab === "team" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ProjectTeamChat record={record} variant="sidebar" embedMode />
          </div>
        ) : null}
      </div>
    </aside>
  );
};
