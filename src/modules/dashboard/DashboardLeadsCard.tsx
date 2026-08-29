import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, UserCheck } from "lucide-react";
import { useGetList } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/modules/constants/contactStatus";
import { getLeadShowPath, getLeadsListPath } from "@/app/routing";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import {
  formatFollowUpDate,
  getLeadNextFollowUpAt,
  isFollowUpOverdue,
  isLeadTerminalStage,
} from "@/modules/leads/leadFollowUpUtils";
import { DashboardModuleCard } from "@/modules/dashboard/DashboardModuleCard";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";

const LEAD_STATUS_FILTER = {
  "status@in": `(${LBS_LEAD_STATUSES_FOR_FILTER.map((status) => `"${status}"`).join(",")})`,
};

const isFollowUpDueToday = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isActionableLead = (contact: Contact) =>
  !isLeadTerminalStage(contact.lead_stage);

export const DashboardLeadsCard = () => {
  const canViewLeads = useMemberCapability("crm.contacts.view");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: leads = [], isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: LEAD_STATUS_FILTER,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { staleTime: 30_000, enabled: canViewLeads },
  );

  const actionableLeads = useMemo(
    () => leads.filter(isActionableLead),
    [leads],
  );

  const dueToday = useMemo(
    () =>
      actionableLeads.filter((lead) =>
        isFollowUpDueToday(getLeadNextFollowUpAt(lead)),
      ).length,
    [actionableLeads],
  );

  const overdue = useMemo(
    () =>
      actionableLeads.filter((lead) =>
        isFollowUpOverdue(getLeadNextFollowUpAt(lead)),
      ).length,
    [actionableLeads],
  );

  const preview = useMemo(
    () =>
      [...actionableLeads]
        .sort((left, right) => {
          const leftFollowUp = getLeadNextFollowUpAt(left);
          const rightFollowUp = getLeadNextFollowUpAt(right);
          const leftOverdue = isFollowUpOverdue(leftFollowUp) ? 0 : 1;
          const rightOverdue = isFollowUpOverdue(rightFollowUp) ? 0 : 1;
          if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
          if (leftFollowUp && rightFollowUp) {
            return (
              new Date(leftFollowUp).getTime() -
              new Date(rightFollowUp).getTime()
            );
          }
          return 0;
        })
        .slice(0, 5),
    [actionableLeads],
  );

  if (!canViewLeads) return null;

  const badges = [
    { label: `${dueToday} due today` },
    ...(overdue > 0
      ? [{ label: `${overdue} overdue`, tone: "danger" as const }]
      : []),
  ];

  return (
    <>
      <DashboardModuleCard
        icon={UserCheck}
        title="Open leads"
        badges={badges}
        isPending={isPending}
        emptyMessage="No active leads on the board."
        viewAllHref={getLeadsListPath()}
        viewAllLabel="View Accounts board"
        addAction={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New lead</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active leads on the board.
          </p>
        ) : (
          <ul className="space-y-2">
            {preview.map((lead) => {
              const followUp = getLeadNextFollowUpAt(lead);
              const overdueFollowUp = isFollowUpOverdue(followUp);
              const followUpLabel = formatFollowUpDate(followUp);

              return (
                <li
                  key={String(lead.id)}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={getLeadShowPath(lead.id)}
                      className="block truncate font-medium link-action"
                    >
                      {getContactFullName(lead)}
                    </Link>
                  </div>
                  {followUpLabel ? (
                    <span
                      className={
                        overdueFollowUp
                          ? "shrink-0 text-xs font-medium text-red-600"
                          : "shrink-0 text-xs text-muted-foreground"
                      }
                    >
                      {followUpLabel}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DashboardModuleCard>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
