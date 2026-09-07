import { useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MarketingCampaignDetailSheet } from "@/modules/marketing/MarketingCampaignDetailSheet";
import { MarketingEmailCampaignDialog } from "@/modules/marketing/MarketingEmailCampaignDialog";
import { marketingCampaignActions } from "@/modules/marketing/marketingCampaignActions";
import {
  EMAIL_CAMPAIGN_STATUS_LABELS,
  formatCampaignStatus,
} from "@/modules/marketing/marketingCampaignStatus";
import { SendCampaignConfirmDialog } from "@/modules/marketing/SendCampaignConfirmDialog";
import { sanitizeTicketEmailHtml } from "@/modules/tickets/sanitizeTicketEmailHtml";
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
  const [create] = useCreate();
  const [deleteOne] = useDelete();
  const canManage = useMemberCapability("marketing.campaigns.manage");
  const canSend = useMemberCapability("marketing.campaigns.send");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<EmailCampaign | null>(
    null,
  );
  const [editCampaign, setEditCampaign] = useState<EmailCampaign | null>(null);
  const [sendCampaign, setSendCampaign] = useState<EmailCampaign | null>(null);

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
    onError: (error: Error) => notify(error.message, { type: "error" }),
    onSettled: () => setBusyId(null),
  });

  const sendMutation = useMutation({
    mutationFn: marketingCampaignActions.startEmailSend,
    onSuccess: () => {
      notify("Campaign queued for sending", { type: "success" });
      setSendCampaign(null);
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
    onSettled: () => setBusyId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: marketingCampaignActions.cancelEmailCampaign,
    onSuccess: () => {
      notify("Campaign cancelled", { type: "info" });
      setDetailCampaign(null);
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
    onSettled: () => setBusyId(null),
  });

  const duplicate = (campaign: EmailCampaign) => {
    create(
      "email_campaigns",
      {
        data: {
          name: `${campaign.name} (copy)`,
          subject: campaign.subject,
          body_html: campaign.body_html,
          body_text: campaign.body_text,
          status: "draft",
          audience_filter: campaign.audience_filter,
        },
      },
      {
        onSuccess: () => {
          notify("Campaign duplicated", { type: "success" });
          refresh();
        },
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Duplicate failed", {
            type: "error",
          }),
      },
    );
  };

  const removeDraft = (campaign: EmailCampaign) => {
    deleteOne(
      "email_campaigns",
      { id: campaign.id, previousData: campaign },
      {
        onSuccess: () => {
          notify("Draft deleted", { type: "info" });
          setDetailCampaign(null);
          refresh();
        },
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Delete failed", {
            type: "error",
          }),
      },
    );
  };

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
    <>
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
            const canBuild =
              canManage && ["draft", "ready"].includes(campaign.status);
            const canStart = canSend && campaign.status === "ready";

            return (
              <TableRow
                key={campaign.id}
                className="cursor-pointer"
                onClick={() => setDetailCampaign(campaign)}
              >
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
                  {campaign.status === "sent" ||
                  campaign.status === "sending" ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {campaign.sent_count ?? 0} sent
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {relativeTime(campaign.updated_at)}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-1">
                    {canBuild ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => {
                          setBusyId(campaign.id);
                          prepareMutation.mutate(campaign.id);
                        }}
                      >
                        <Users className="size-3.5" />
                        Build
                      </Button>
                    ) : null}
                    {canStart ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setSendCampaign(campaign)}
                      >
                        <Play className="size-3.5" />
                        Send
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="ghost">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setDetailCampaign(campaign)}
                        >
                          <Eye className="size-3.5" />
                          View details
                        </DropdownMenuItem>
                        {canManage &&
                        ["draft", "ready"].includes(campaign.status) ? (
                          <DropdownMenuItem
                            onClick={() => setEditCampaign(campaign)}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </DropdownMenuItem>
                        ) : null}
                        {canManage ? (
                          <DropdownMenuItem onClick={() => duplicate(campaign)}>
                            <Copy className="size-3.5" />
                            Duplicate
                          </DropdownMenuItem>
                        ) : null}
                        {canManage &&
                        ["draft", "ready", "building", "sending"].includes(
                          campaign.status,
                        ) ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setBusyId(campaign.id);
                              cancelMutation.mutate(campaign.id);
                            }}
                          >
                            <XCircle className="size-3.5" />
                            Cancel
                          </DropdownMenuItem>
                        ) : null}
                        {canManage && campaign.status === "draft" ? (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => removeDraft(campaign)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete draft
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <MarketingCampaignDetailSheet
        channel="email"
        campaign={detailCampaign}
        open={Boolean(detailCampaign)}
        onOpenChange={(open) => !open && setDetailCampaign(null)}
        canManage={canManage}
        canSend={canSend}
        isBusy={busyId === detailCampaign?.id}
        onEdit={() => {
          if (detailCampaign) setEditCampaign(detailCampaign);
        }}
        onBuild={() => {
          if (!detailCampaign) return;
          setBusyId(detailCampaign.id);
          prepareMutation.mutate(detailCampaign.id);
        }}
        onSend={() => {
          if (detailCampaign) setSendCampaign(detailCampaign);
        }}
        onCancel={() => {
          if (!detailCampaign) return;
          setBusyId(detailCampaign.id);
          cancelMutation.mutate(detailCampaign.id);
        }}
        onDuplicate={() => detailCampaign && duplicate(detailCampaign)}
        onDelete={() => detailCampaign && removeDraft(detailCampaign)}
      />

      <MarketingEmailCampaignDialog
        open={Boolean(editCampaign)}
        onOpenChange={(open) => !open && setEditCampaign(null)}
        campaign={editCampaign}
      />

      <SendCampaignConfirmDialog
        open={Boolean(sendCampaign)}
        onOpenChange={(open) => !open && setSendCampaign(null)}
        title="Send email campaign?"
        description="Marketing emails include an automatic unsubscribe link."
        recipientCount={sendCampaign?.recipient_count}
        isPending={sendMutation.isPending}
        preview={
          <div>
            <p className="mb-2 text-sm font-medium">{sendCampaign?.subject}</p>
            <div
              className="prose prose-sm max-w-none text-sm dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: sanitizeTicketEmailHtml(sendCampaign?.body_html ?? ""),
              }}
            />
          </div>
        }
        onConfirm={() => {
          if (!sendCampaign) return;
          setBusyId(sendCampaign.id);
          sendMutation.mutate(sendCampaign.id);
        }}
      />
    </>
  );
};
