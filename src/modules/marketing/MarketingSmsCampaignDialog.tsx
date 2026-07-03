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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarketingAudienceFilterFields } from "@/modules/marketing/MarketingAudienceFilterFields";
import { DEFAULT_SMS_AUDIENCE_FILTER } from "@/modules/marketing/marketingAudienceDefaults";
import { summarizeAudienceFilter } from "@/modules/marketing/marketingAudienceLabels";
import {
  appendSmsStopFooter,
  getSmsSegmentInfo,
} from "@/modules/marketing/marketingPreviewUtils";
import type { MarketingAudienceFilter, SmsCampaign } from "@/modules/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: SmsCampaign | null;
};

export const MarketingSmsCampaignDialog = ({
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
  const [body, setBody] = useState("");
  const [includeStopFooter, setIncludeStopFooter] = useState(true);
  const [audienceFilter, setAudienceFilter] = useState<MarketingAudienceFilter>(
    DEFAULT_SMS_AUDIENCE_FILTER,
  );

  useEffect(() => {
    if (!open) return;
    setTab("content");
    if (campaign) {
      setName(campaign.name ?? "");
      setBody(campaign.body ?? "");
      setIncludeStopFooter(campaign.include_stop_footer !== false);
      setAudienceFilter(campaign.audience_filter ?? DEFAULT_SMS_AUDIENCE_FILTER);
    } else {
      setName("");
      setBody("");
      setIncludeStopFooter(true);
      setAudienceFilter(DEFAULT_SMS_AUDIENCE_FILTER);
    }
  }, [open, campaign]);

  const previewBody = useMemo(
    () =>
      includeStopFooter ? appendSmsStopFooter(body) : body.trim(),
    [body, includeStopFooter],
  );
  const segmentInfo = useMemo(
    () => getSmsSegmentInfo(previewBody),
    [previewBody],
  );

  const handleSubmit = () => {
    if (!name.trim() || !body.trim()) {
      notify("Name and message are required", { type: "warning" });
      setTab("content");
      return;
    }

    const data = {
      name: name.trim(),
      body: body.trim(),
      audience_filter: audienceFilter,
      include_stop_footer: includeStopFooter,
      ...(isEdit && campaign?.status === "ready"
        ? { status: "draft", recipient_count: 0, skipped_count: 0 }
        : { status: "draft" }),
    };

    if (isEdit && campaign) {
      update(
        "sms_campaigns",
        { id: campaign.id, data, previousData: campaign },
        {
          onSuccess: () => {
            notify("SMS campaign updated", { type: "success" });
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
      "sms_campaigns",
      { data: data satisfies Partial<SmsCampaign> },
      {
        onSuccess: () => {
          notify("SMS campaign created", { type: "success" });
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
            {isEdit ? "Edit SMS campaign" : "New SMS campaign"}
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
              <Label htmlFor="sms-campaign-name">Campaign name</Label>
              <Input
                id="sms-campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring promo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-campaign-body">Message</Label>
              <Textarea
                id="sms-campaign-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Your promotional message…"
              />
              <p className="text-xs text-muted-foreground">
                {segmentInfo.length} chars · {segmentInfo.segments} segment
                {segmentInfo.segments === 1 ? "" : "s"} (max{" "}
                {segmentInfo.max})
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Include STOP footer</p>
                <p className="text-xs text-muted-foreground">
                  Appends “Reply STOP to opt out.” for compliance.
                </p>
              </div>
              <Switch
                checked={includeStopFooter}
                onCheckedChange={setIncludeStopFooter}
              />
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-4 max-h-[50vh] overflow-y-auto">
            <MarketingAudienceFilterFields
              channel="sms"
              value={audienceFilter}
              onChange={setAudienceFilter}
              campaignId={campaign?.id}
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message preview
              </p>
              <p className="whitespace-pre-wrap text-sm">{previewBody || "—"}</p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {summarizeAudienceFilter(audienceFilter, "sms").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
