import { useState } from "react";
import { useGetList } from "ra-core";
import { Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefRequestScope } from "@/modules/deals/projectBriefRequestScope";
import { WebsiteBriefAccordion } from "@/modules/deals/WebsiteBriefAccordion";
import { useProjectBriefActions } from "@/modules/deals/projects/ProjectBriefActionsProvider";
import type { FormSubmissionV2, PublicFormToken } from "@/modules/forms/types";
import type { LbsDeal } from "@/modules/types";

const formatActivityDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const WebsiteBriefTab = ({ record }: { record: LbsDeal }) => {
  const { openRequestBrief } = useProjectBriefActions();

  const openRequestDialog = (scope?: BriefRequestScope) => {
    openRequestBrief(scope);
  };

  const { data: submissions = [] } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "submitted_at", order: "DESC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const { data: sentTokens = [] } = useGetList<PublicFormToken>(
    "public_form_tokens",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const latestSentToken = sentTokens[0];
  const latestSubmission = submissions[0];
  const showFormStatus = Boolean(latestSubmission || latestSentToken);

  const formStatusBanner = showFormStatus ? (
    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {latestSubmission ? (
          <p>
            <span className="font-medium">Client submitted</span>
            {latestSubmission.submitted_at
              ? ` · ${formatActivityDate(String(latestSubmission.submitted_at))}`
              : ""}
          </p>
        ) : (
          <p>
            <span className="font-medium">Form sent to client</span>
            {latestSentToken?.created_at
              ? ` · ${formatActivityDate(String(latestSentToken.created_at))}`
              : ""}
          </p>
        )}
      </div>
      {latestSentToken && !latestSubmission ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openRequestDialog()}
        >
          <Mail className="size-4" />
          Send reminder
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <WebsiteBriefAccordion
      record={record}
      onRequestSection={openRequestDialog}
      formStatusBanner={formStatusBanner}
    />
  );
};
