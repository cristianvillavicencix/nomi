import { Link } from "react-router";
import { EditButton } from "@/components/admin/edit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAgencyProjectTypeLabel,
  getDeliveryStatusLabel,
  LBS_PROJECT_PRIORITIES,
  lbsDeliveryStatuses,
} from "@/lbs/deals/lbsAgencyProjectModel";
import { getLbsProjectStageLabel } from "@/lbs/deals/lbsProjectConstants";
import { ProjectSecurityTab } from "@/lbs/deals/ProjectSecurityTab";
import { ClientPortalSection } from "@/lbs/portal/ClientPortalSection";
import type { LbsDeal } from "@/lbs/types";

export const ProjectSettingsTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Project settings</CardTitle>
        <EditButton resource="deals" record={record} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <div className="text-muted-foreground">Project type</div>
          <div className="font-medium">
            {getAgencyProjectTypeLabel(record.project_type)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Stage</div>
          <div className="font-medium">
            {getLbsProjectStageLabel(record.stage)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Delivery status</div>
          <div className="font-medium capitalize">
            {getDeliveryStatusLabel(record.delivery_status) || "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Priority</div>
          <Badge variant="outline" className="capitalize">
            {record.priority ?? "normal"}
          </Badge>
        </div>
        <div>
          <div className="text-muted-foreground">Start date</div>
          <div className="font-medium">{record.start_date ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Target launch</div>
          <div className="font-medium">{record.expected_end_date ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Lifecycle</div>
          <div className="font-medium capitalize">
            {record.lifecycle_phase ?? "delivery"}
          </div>
        </div>
        {record.accepted_proposal_id ? (
          <div>
            <div className="text-muted-foreground">Accepted proposal</div>
            <Link
              to={`/proposals/${record.accepted_proposal_id}/show`}
              className="link-action"
            >
              View proposal
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p>
          Delivery statuses:{" "}
          {lbsDeliveryStatuses.map((s) => s.label).join(", ")}
        </p>
        <p>
          Priorities: {LBS_PROJECT_PRIORITIES.map((p) => p.label).join(", ")}
        </p>
      </CardContent>
    </Card>

    <ClientPortalSection record={record} />

    <div>
      <h3 className="mb-3 text-base font-semibold">Credentials & access</h3>
      <ProjectSecurityTab record={record} />
    </div>
  </div>
);
