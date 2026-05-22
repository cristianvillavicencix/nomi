import type { ReactNode } from "react";
import { Link } from "react-router";
import { useGetList } from "ra-core";
import type { Task } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { isTaskOverdue } from "@/components/atomic-crm/tasks/taskStats";
import {
  getLbsProjectStageLabel,
  lbsProjectTypeChoices,
} from "@/lbs/deals/lbsProjectConstants";
import { BriefProgressBar } from "@/lbs/deals/BriefProgressBar";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryCountdown,
  getProjectDeliveryDate,
  getProjectDeliveryUrgencyClassName,
  getProjectDeliveryUrgency,
} from "@/lbs/deals/projectDeliveryDate";
import { getProjectBriefProgress } from "@/lbs/deals/projectBriefProgress";
import { ProjectCalendarEventsList } from "@/lbs/calendar/ProjectCalendarEventsList";
import { ProjectGithubLink } from "@/lbs/deals/ProjectGithubLink";
import type { LbsDeal } from "@/lbs/types";

const formatMoney = (value?: number | null) => {
  if (value == null) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
};

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, " ") ??
  "—";

const OverviewField = ({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-medium">{children}</div>
  </div>
);

export const LbsProjectOverviewTab = ({ record }: { record: LbsDeal }) => {
  const { dealStages } = useConfigurationContext();
  const stageLabel =
    getLbsProjectStageLabel(record.stage) ||
    dealStages.find((stage) => stage.value === record.stage)?.label ||
    record.stage;

  const { data: openTasks = [] } = useGetList<Task>(
    "tasks",
    {
      filter: {
        ...TASK_STATUS_FILTERS.open,
        "deal_id@eq": record.id,
      },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "due_date", order: "ASC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const formatDue = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const deliveryDate = getProjectDeliveryDate(record);
  const deliveryDateLabel = formatProjectDeliveryDate(deliveryDate);
  const deliveryCountdown = getProjectDeliveryCountdown(deliveryDate, {
    stage: record.stage,
    actualCompletionDate: record.actual_completion_date,
  });
  const briefProgress = getProjectBriefProgress(record);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <OverviewField label="Stage">{stageLabel}</OverviewField>
            <OverviewField label="Service type">
              {getProjectTypeLabel(record.project_type ?? record.category)}
            </OverviewField>
            <OverviewField label="Budget">{formatMoney(record.amount)}</OverviewField>
            <OverviewField label="Delivery date">
              {deliveryDateLabel ?? "—"}
            </OverviewField>
            <OverviewField label="Time to delivery">
              {deliveryCountdown ? (
                <span
                  className={getProjectDeliveryUrgencyClassName(
                    getProjectDeliveryUrgency(deliveryDate, { stage: record.stage }),
                  )}
                >
                  {deliveryCountdown.label}
                </span>
              ) : (
                "—"
              )}
            </OverviewField>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Project brief</h3>
                <p className="text-sm text-muted-foreground">
                  {briefProgress.percent}% complete
                </p>
              </div>
              <Link
                to={`/deals/${record.id}/show?tab=website-brief`}
                className="text-sm link-action"
              >
                Open brief
              </Link>
            </div>
            <BriefProgressBar percent={briefProgress.percent} showLabel className="mt-3" />
          </div>

          {String(record.description ?? record.notes ?? "").trim() ? (
            <OverviewField label="Internal notes">
              <span className="whitespace-pre-wrap font-normal">
                {String(record.description ?? record.notes)}
              </span>
            </OverviewField>
          ) : null}
        </div>

        <div className="rounded-lg border p-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Next tasks due</h3>
            <Link
              to={`/deals/${record.id}/show?tab=tasks`}
              className="text-sm link-action"
            >
              View all tasks
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open tasks on this project.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {openTasks.map((task) => (
                <li
                  key={String(task.id)}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <TaskDescriptionCell text={task.text} useMentions />
                  </div>
                  <span
                    className={`shrink-0 text-xs ${isTaskOverdue(task) ? "font-medium text-red-600" : "text-muted-foreground"}`}
                  >
                    {formatDue(task.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">Upcoming events</h4>
              <Link to="/calendar" className="text-xs link-action">
                Calendar
              </Link>
            </div>
            <ProjectCalendarEventsList
              dealId={record.id}
              limit={5}
              className="mt-3"
              emptyMessage="No events linked to this project."
            />
          </div>
        </div>
      </div>

      <ProjectGithubLink record={record} showEditLink />
    </div>
  );
};
