import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { useGetList, useGetOne } from "ra-core";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Contact, Task } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
  formatDateTime,
} from "@/lbs/clients/clientShowUtils";
import { ContactQuickActions } from "@/lbs/contacts/ContactQuickActions";
import {
  formatFollowUpDate,
  getLeadNextFollowUpAt,
  isFollowUpOverdue,
  isLeadTerminalStage,
} from "@/lbs/leads/leadFollowUpUtils";
import { getLeadStageDef } from "@/lbs/leads/leadStages";
import { getClientShowPath } from "@/lbs/routing";
import { cn } from "@/lib/utils";

const ProfileSectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </p>
);

const ProfileInfoRow = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) => (
  <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <div className={cn("min-w-0 truncate font-medium", valueClassName)}>
      {value}
    </div>
  </div>
);

export const LeadSummaryCard = ({ record }: { record: Contact }) => {
  const fullName = getContactFullName(record);
  const stage = getLeadStageDef(record.lead_stage);
  const terminalStage = isLeadTerminalStage(record.lead_stage);

  const { data: company } = useGetOne(
    "companies",
    { id: record.company_id! },
    { enabled: record.company_id != null },
  );

  const { data: openTasks = [] } = useGetList<Task>(
    "tasks",
    {
      filter: {
        "contact_id@eq": record.id,
        "done_date@is": null,
      },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 1 },
    },
    { staleTime: 30_000, enabled: !terminalStage },
  );

  const companyName = useMemo(
    () => record.company_name?.trim() || company?.name?.trim(),
    [record.company_name, company?.name],
  );

  const nextFollowUpAt =
    getLeadNextFollowUpAt(record) ?? openTasks[0]?.due_date ?? null;
  const nextFollowUpLabel = formatFollowUpDate(nextFollowUpAt);
  const followUpOverdue = isFollowUpOverdue(nextFollowUpAt);

  const statusLabel = record.status
    ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
    : "Lead";

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-4 py-4">
        <div className="flex flex-col items-center text-center">
          <Avatar record={record} width={40} height={40} />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <h1 className="text-lg font-semibold leading-tight">{fullName}</h1>
            <Badge variant="secondary" className="capitalize">
              {statusLabel}
            </Badge>
          </div>
          <Badge
            variant="outline"
            className="mt-2 capitalize"
            style={{ borderColor: stage.color, color: stage.color }}
          >
            {stage.label}
          </Badge>
        </div>

        {!terminalStage && nextFollowUpLabel ? (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              followUpOverdue
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border bg-muted/30 text-foreground",
            )}
          >
            {followUpOverdue ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold tracking-wide uppercase">
                {followUpOverdue ? "Follow-up overdue" : "Next follow-up"}
              </p>
              <p className="font-medium">{nextFollowUpLabel}</p>
              {openTasks[0]?.text ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {openTasks[0].text}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <ContactQuickActions contactId={record.id} contact={record} />
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <ProfileSectionTitle>Key information</ProfileSectionTitle>
          <ProfileInfoRow label="Stage" value={stage.label} />
          <ProfileInfoRow
            label="Service"
            value={record.interested_service?.trim() || "—"}
          />
          <ProfileInfoRow
            label="Source"
            value={record.lead_source?.trim() || "—"}
          />
          <ProfileInfoRow
            label="Company"
            value={
              record.company_id && companyName ? (
                <Link
                  to={getClientShowPath(record.company_id)}
                  className="link-action block truncate font-medium"
                >
                  {companyName}
                </Link>
              ) : (
                record.company_name?.trim() || "—"
              )
            }
          />
          <ProfileInfoRow label="Phone" value={getContactPhone(record)} />
          <ProfileInfoRow label="Email" value={getContactEmail(record)} />
          <ProfileInfoRow
            label="Last contact"
            value={formatDateTime(record.last_contacted_at) || "—"}
          />
          <ProfileInfoRow
            label="Created"
            value={formatDateTime(record.first_seen)}
          />
          {record.lead_value_estimate != null &&
          record.lead_value_estimate > 0 ? (
            <ProfileInfoRow
              label="Est. value"
              value={new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(record.lead_value_estimate)}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
