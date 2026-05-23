import { Link } from "react-router";
import { useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgencyProjectTypeLabel, getDeliveryStatusLabel } from "@/lbs/deals/lbsAgencyProjectModel";
import { getProjectBriefProgress } from "@/lbs/deals/projectBriefProgress";
import { getLbsProjectStageLabel } from "@/lbs/deals/lbsProjectConstants";
import { BriefProgressBar } from "@/lbs/deals/BriefProgressBar";
import { SendProjectResourcesDialog } from "@/lbs/deals/SendProjectResourcesDialog";
import { useState } from "react";
import type { DealResource, LbsDeal } from "@/lbs/types";
import { Button } from "@/components/ui/button";

export const ProjectContextPanel = ({
  record,
  resources,
}: {
  record: LbsDeal;
  resources: DealResource[];
}) => {
  const [sendOpen, setSendOpen] = useState(false);
  const briefProgress = getProjectBriefProgress(record);
  const missingLogo = !resources.some((r) => r.category === "logo");

  const { total: openTasks = 0 } = useGetList(
    "tasks",
    {
      filter: { "deal_id@eq": record.id, "done_date@is": null },
      pagination: { page: 1, perPage: 1 },
    },
    { staleTime: 30_000 },
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Project health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">Stage</div>
            <div className="font-medium">{getLbsProjectStageLabel(record.stage)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium capitalize">
              {getDeliveryStatusLabel(record.delivery_status) || "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Service</div>
            <div className="font-medium">{getAgencyProjectTypeLabel(record.project_type)}</div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Brief</span>
              <span>{briefProgress.percent}%</span>
            </div>
            <BriefProgressBar percent={briefProgress.percent} className="mt-1" />
          </div>
          {missingLogo ? (
            <Badge variant="outline" className="text-amber-700">
              Logo missing
            </Badge>
          ) : null}
          {typeof openTasks === "number" && openTasks > 0 ? (
            <div className="text-muted-foreground">{openTasks} open task{openTasks === 1 ? "" : "s"}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSendOpen(true)}>
            Request client assets
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <Link to={`/deals/${record.id}/show?tab=messages`}>Open messages</Link>
          </Button>
        </CardContent>
      </Card>

      <SendProjectResourcesDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        dealId={record.id}
        companyId={record.company_id}
        contactId={record.contact_id}
        projectName={record.name}
      />
    </div>
  );
};
