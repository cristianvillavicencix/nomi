import { useState } from "react";
import { useGetList, useNotify, useRefresh } from "ra-core";
import { Loader2, Play, Users, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { marketingCampaignActions } from "@/modules/marketing/marketingCampaignActions";
import {
  EMAIL_CAMPAIGN_STATUS_LABELS,
  formatCampaignStatus,
} from "@/modules/marketing/marketingCampaignStatus";
import type { EmailCampaign } from "@/modules/types";

const relativeTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export const EmailCampaignsPanel = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("marketing.campaigns.manage");
  const canSend = useMemberCapability("marketing.campaigns.send");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: campaigns = [], isPending } = useGetList<EmailCampaign>(
    "email_campaigns",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
  );

  const prepareMutation = useMutation({
    mutationFn: marketingCampaignActions.prepareEmailAudience,
    onSuccess: (result) => {
      notify(
        `Audience ready: ${result.pending} to send, ${result.skipped} skipped`,
        { type: "success" },
      );
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message, { type: "error" });
    },
    onSettled: () => setBusyId(null),
  });

  const sendMutation = useMutation({
    mutationFn: marketingCampaignActions.startEmailSend,
    onSuccess: () => {
      notify("Campaign queued for sending", { type: "success" });
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message, { type: "error" });
    },
    onSettled: () => setBusyId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: marketingCampaignActions.cancelEmailCampaign,
    onSuccess: () => {
      notify("Campaign cancelled", { type: "info" });
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message, { type: "error" });
    },
    onSettled: () => setBusyId(null),
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading campaigns…
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No email campaigns yet. Create a draft to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Recipients</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => {
          const isBusy = busyId === campaign.id;
          const canBuild = canManage && ["draft", "ready"].includes(campaign.status);
          const canStart = canSend && campaign.status === "ready";
          const canCancel = canManage &&
            ["draft", "ready", "building", "sending"].includes(campaign.status);

          return (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {campaign.subject}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {formatCampaignStatus(
                    campaign.status,
                    EMAIL_CAMPAIGN_STATUS_LABELS,
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                {campaign.recipient_count ?? 0}
                {campaign.status === "sent" || campaign.status === "sending" ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {campaign.sent_count ?? 0} sent
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {relativeTime(campaign.updated_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {canBuild ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => {
                        setBusyId(campaign.id);
                        prepareMutation.mutate(campaign.id);
                      }}
                    >
                      <Users className="size-3.5" />
                      Build audience
                    </Button>
                  ) : null}
                  {canStart ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => {
                        setBusyId(campaign.id);
                        sendMutation.mutate(campaign.id);
                      }}
                    >
                      <Play className="size-3.5" />
                      Send
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => {
                        setBusyId(campaign.id);
                        cancelMutation.mutate(campaign.id);
                      }}
                    >
                      <XCircle className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
