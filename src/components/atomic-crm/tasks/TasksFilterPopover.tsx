import { useGetList } from "ra-core";
import { SlidersHorizontal } from "lucide-react";
import type { Deal } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES } from "@/components/atomic-crm/tasks/taskConstants";
import type { TaskScopeFilter } from "@/components/atomic-crm/tasks/scopedTasks";
import type { TaskPreferences } from "@/components/atomic-crm/tasks/useTaskPreferences";
import { taskPreferencesHaveActiveFilters } from "@/components/atomic-crm/tasks/useTaskPreferences";

const ALL_PROJECTS = "all";

const getDealLabel = (deal: Deal) => deal.name?.trim() || `Project #${deal.id}`;

export const TasksFilterPopover = ({
  preferences,
  onChange,
  scopeOptions,
  taskTypes,
  lbsMode,
  unreadTaggedCount = 0,
}: {
  preferences: TaskPreferences;
  onChange: (update: Partial<TaskPreferences>) => void;
  scopeOptions: ReadonlyArray<{ value: TaskScopeFilter; label: string }>;
  taskTypes: ReadonlyArray<{ value: string; label: string }>;
  lbsMode: boolean;
  unreadTaggedCount?: number;
}) => {
  const { scope, typeFilter, priorityFilter, projectId } = preferences;

  const { data: deals = [], isPending: isDealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: lbsMode, staleTime: 60_000 },
  );

  const hasActiveFilters = taskPreferencesHaveActiveFilters(preferences, {
    lbsMode,
  });
  const showTaggedBadge = unreadTaggedCount > 0 && scope !== "tagged";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="size-4" />
          Filter
          {hasActiveFilters || showTaggedBadge ? (
            <span className="size-2 rounded-full bg-primary" aria-hidden />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="tasks-filter-assigned">Assigned</Label>
            <Select
              value={scope}
              onValueChange={(value) =>
                onChange({ scope: value as TaskScopeFilter })
              }
            >
              <SelectTrigger id="tasks-filter-assigned">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lbsMode ? (
            <div className="space-y-2">
              <Label htmlFor="tasks-filter-project">Project</Label>
              <Select
                value={projectId != null ? String(projectId) : ALL_PROJECTS}
                onValueChange={(value) =>
                  onChange({ projectId: value === ALL_PROJECTS ? null : value })
                }
                disabled={isDealsPending}
              >
                <SelectTrigger id="tasks-filter-project">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={String(deal.id)}>
                      {getDealLabel(deal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {!lbsMode ? (
            <div className="space-y-2">
              <Label htmlFor="tasks-filter-type">Type</Label>
              <Select
                value={typeFilter}
                onValueChange={(value) => onChange({ typeFilter: value })}
              >
                <SelectTrigger id="tasks-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {taskTypes.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="tasks-filter-priority">Priority</Label>
            <Select
              value={priorityFilter}
              onValueChange={(value) => onChange({ priorityFilter: value })}
            >
              <SelectTrigger id="tasks-filter-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {TASK_PRIORITIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
