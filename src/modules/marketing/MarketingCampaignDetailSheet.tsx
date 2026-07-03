import { useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { summarizeAudienceFilter } from "@/modules/marketing/marketingAudienceLabels";
import {
  formatCampaignStatus,
  SMS_CAMPAIGN_STATUS_LABELS,
  EMAIL_CAMPAIGN_STATUS_LABELS,
} from "@/modules/marketing/marketingCampaignStatus";
import {
  appendSmsStopFooter,
  textToMarketingEmailHtml,
} from "@/modules/marketing/marketingPreviewUtils";
import type { EmailCampaign, SmsCampaign } from "@/modules/types";

type Channel = "sms" | "email";

type Props = {
  channel: Channel;
  campaign: SmsCampaign | EmailCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onBuild?: () => void;
  onSend?: () => void;
  onCancel?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  canSend?: boolean;
  isBusy?: boolean;
};

export const MarketingCampaignDetailSheet = ({
  channel,
  campaign,
  open,
  onOpenChange,
  onEdit,
  onBuild,
  onSend,
  onCancel,
  onDuplicate,
  onDelete,
  canManage,
  canSend,
  isBusy,
}: Props) => {
  const smsCampaign = channel === "sms" ? (campaign as SmsCampaign | null) : null;
  const emailCampaign =
    channel === "email" ? (campaign as EmailCampaign | null) : null;

  const recipientResource =
    channel === "sms" ? "sms_campaign_recipients" : "email_campaign_recipients";

  const { data: recipients = [] } = useGetList<{
    id: number;
    status: string;
    phone_e164?: string;
    email?: string;
    error_message?: string | null;
  }>(recipientResource, {
    filter: campaign?.id
      ? { "campaign_id@eq": campaign.id }
      : { "campaign_id@eq": -1 },
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });

  if (!campaign) return null;

  const statusLabels =
    channel === "sms" ? SMS_CAMPAIGN_STATUS_LABELS : EMAIL_CAMPAIGN_STATUS_LABELS;
  const canEdit =
    canManage && ["draft", "ready"].includes(campaign.status);
  const canBuildAudience =
    canManage && ["draft", "ready"].includes(campaign.status);
  const canStartSend = canSend && campaign.status === "ready";
  const canCancelCampaign =
    canManage &&
    ["draft", "ready", "building", "sending"].includes(campaign.status);
  const canDeleteDraft = canManage && campaign.status === "draft";

  const preview =
    channel === "sms" && smsCampaign ? (
      <p className="whitespace-pre-wrap text-sm">
        {smsCampaign.include_stop_footer !== false
          ? appendSmsStopFooter(smsCampaign.body)
          : smsCampaign.body}
      </p>
    ) : emailCampaign ? (
      <div>
        <p className="mb-2 text-sm font-medium">{emailCampaign.subject}</p>
        <div
          className="prose prose-sm max-w-none text-sm dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: emailCampaign.body_html || textToMarketingEmailHtml(emailCampaign.body_text ?? ""),
          }}
        />
      </div>
    ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>{campaign.name}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {formatCampaignStatus(campaign.status, statusLabels)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {campaign.recipient_count ?? 0} recipients · {campaign.sent_count ?? 0}{" "}
              sent · {campaign.failed_count ?? 0} failed ·{" "}
              {campaign.skipped_count ?? 0} skipped
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Audience
            </p>
            {summarizeAudienceFilter(campaign.audience_filter, channel).map(
              (line) => (
                <p key={line} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ),
            )}
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">{preview}</div>

          {recipients.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recipients (sample)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{channel === "sms" ? "Phone" : "Email"}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.slice(0, 10).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">
                        {channel === "sms" ? row.phone_e164 : row.email}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.status}
                        {row.error_message ? ` (${row.error_message})` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canEdit && onEdit ? (
              <Button type="button" size="sm" variant="outline" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
            {canBuildAudience && onBuild ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={onBuild}
              >
                Build audience
              </Button>
            ) : null}
            {canStartSend && onSend ? (
              <Button type="button" size="sm" disabled={isBusy} onClick={onSend}>
                Send
              </Button>
            ) : null}
            {onDuplicate ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={onDuplicate}
              >
                Duplicate
              </Button>
            ) : null}
            {canCancelCampaign && onCancel ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isBusy}
                onClick={onCancel}
              >
                Cancel campaign
              </Button>
            ) : null}
            {canDeleteDraft && onDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isBusy}
                onClick={onDelete}
              >
                Delete draft
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
