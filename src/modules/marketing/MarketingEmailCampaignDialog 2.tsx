import { useEffect, useMemo, useState } from "react";
import { useCreate, useNotify, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarketingAudienceFilterFields } from "@/modules/marketing/MarketingAudienceFilterFields";
import { DEFAULT_EMAIL_AUDIENCE_FILTER } from "@/modules/marketing/marketingAudienceDefaults";
import { summarizeAudienceFilter } from "@/modules/marketing/marketingAudienceLabels";
import { textToMarketingEmailHtml } from "@/modules/marketing/marketingPreviewUtils";
import type { EmailCampaign, MarketingAudienceFilter } from "@/modules/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: EmailCampaign | null;
};

export const MarketingEmailCampaignDialog = ({
  open,
  onOpenChange,
  campaign,
}: Props) => {
  const isEdit = Boolean(campaign?.id);
  const notify = useNotify();
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [tab, setTab] = useState("content");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<MarketingAudienceFilter>(
    DEFAULT_EMAIL_AUDIENCE_FILTER,
  );

  useEffect(() => {
    if (!open) return;
    setTab("content");
    if (campaign) {
      setName(campaign.name ?? "");
      setSubject(campaign.subject ?? "");
      setBody(campaign.body_text ?? "");
      setAudienceFilter(
        campaign.audience_filter ?? DEFAULT_EMAIL_AUDIENCE_FILTER,
      );
    } else {
      setName("");
      setSubject("");
      setBody("");
      setAudienceFilter(DEFAULT_EMAIL_AUDIENCE_FILTER);
    }
  }, [open, campaign]);

  const previewHtml = useMemo(
    () => textToMarketingEmailHtml(body),
    [body],
  );

  const handleSubmit = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      notify("Name, subject, and body are required", { type: "warning" });
      setTab("content");
      return;
    }

    const trimmedBody = body.trim();
    const data = {
      name: name.trim(),
      subject: subject.trim(),
      body_html: textToMarketingEmailHtml(trimmedBody),
      body_text: trimmedBody,
      audience_filter: audienceFilter,
      ...(isEdit && campaign?.status === "ready"
        ? { status: "draft", recipient_count: 0, skipped_count: 0 }
        : { status: "draft" }),
    };

    if (isEdit && campaign) {
      update(
        "email_campaigns",
        { id: campaign.id, data, previousData: campaign },
        {
          onSuccess: () => {
            notify("Email campaign updated", { type: "success" });
            onOpenChange(false);
          },
          onError: (error) => {
            notify(error instanceof Error ? error.message : "Update failed", {
              type: "error",
            });
          },
        },
      );
      return;
    }

    create(
      "email_campaigns",
      { data: data satisfies Partial<EmailCampaign> },
      {
        onSuccess: () => {
          notify("Email campaign created", { type: "success" });
          onOpenChange(false);
        },
        onError: (error) => {
          notify(error instanceof Error ? error.message : "Create failed", {
            type: "error",
          });
        },
      },
    );
  };

  const isPending = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit email campaign" : "New email campaign"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-campaign-name">Campaign name</Label>
              <Input
                id="email-campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Newsletter — June"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-campaign-subject">Subject</Label>
              <Input
                id="email-campaign-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your subject line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-campaign-body">Body</Label>
              <Textarea
                id="email-campaign-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your email content. Blank lines separate paragraphs."
              />
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-4 max-h-[50vh] overflow-y-auto">
            <MarketingAudienceFilterFields
              channel="email"
              value={audienceFilter}
              onChange={setAudienceFilter}
              campaignId={campaign?.id}
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <p className="mb-4 text-sm font-medium">{subject || "—"}</p>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Body preview
              </p>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html:
                    previewHtml ||
                    '<p class="text-muted-foreground">No content yet</p>',
                }}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Unsubscribe link is added automatically when sent.
              </p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {summarizeAudienceFilter(audienceFilter, "email").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isEdit ? "Save changes" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
