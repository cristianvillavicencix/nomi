import { useEffect, useState } from "react";
import { useGetList } from "ra-core";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CONTACT_STATUS_CHOICES } from "@/modules/constants/contactStatus";
import { marketingCampaignActions } from "@/modules/marketing/marketingCampaignActions";
import type { MarketingAudienceFilter } from "@/modules/types";

type Props = {
  channel: "sms" | "email";
  value: MarketingAudienceFilter;
  onChange: (next: MarketingAudienceFilter) => void;
  campaignId?: number;
};

export const MarketingAudienceFilterFields = ({
  channel,
  value,
  onChange,
  campaignId,
}: Props) => {
  const { data: tags = [] } = useGetList<{ id: number; name: string }>("tags", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const selectedStatuses = new Set(value.statuses ?? []);
  const selectedTags = new Set(value.tags ?? []);
  const requireOptIn =
    channel === "sms"
      ? value.require_sms_opt_in !== false
      : value.require_email_opt_in !== false;

  const [estimate, setEstimate] = useState<{
    pending: number;
    skipped: number;
    matched_contacts: number;
  } | null>(null);

  const estimateMutation = useMutation({
    mutationFn: () =>
      channel === "sms"
        ? marketingCampaignActions.estimateSmsAudience(value, campaignId)
        : marketingCampaignActions.estimateEmailAudience(value, campaignId),
    onSuccess: (result) => {
      setEstimate({
        pending: result.pending,
        skipped: result.skipped,
        matched_contacts: result.matched_contacts ?? result.total,
      });
    },
  });

  useEffect(() => {
    setEstimate(null);
  }, [value, channel]);

  const toggleStatus = (status: string, checked: boolean) => {
    const next = new Set(selectedStatuses);
    if (checked) next.add(status);
    else next.delete(status);
    onChange({
      ...value,
      statuses: [...next],
    });
  };

  const toggleTag = (tag: string, checked: boolean) => {
    const next = new Set(selectedTags);
    if (checked) next.add(tag);
    else next.delete(tag);
    onChange({
      ...value,
      tags: [...next],
    });
  };

  const setRequireOptIn = (checked: boolean) => {
    if (channel === "sms") {
      onChange({ ...value, require_sms_opt_in: checked });
    } else {
      onChange({ ...value, require_email_opt_in: checked });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Contact status</Label>
        <p className="text-xs text-muted-foreground">
          Leave empty to include all statuses with a phone or email.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTACT_STATUS_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={selectedStatuses.has(choice.value)}
                onCheckedChange={(checked) =>
                  toggleStatus(choice.value, checked === true)
                }
              />
              {choice.label}
            </label>
          ))}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="space-y-2">
          <Label>Tags</Label>
          <p className="text-xs text-muted-foreground">
            Match contacts with any selected tag.
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = selectedTags.has(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.name, !active)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant={active ? "default" : "outline"}>
                    {tag.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Require marketing opt-in</p>
          <p className="text-xs text-muted-foreground">
            Recommended for compliance. Only contacts who opted in are included.
          </p>
        </div>
        <Switch checked={requireOptIn} onCheckedChange={setRequireOptIn} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={estimateMutation.isPending}
          onClick={() => estimateMutation.mutate()}
        >
          {estimateMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : null}
          Estimate audience
        </Button>
        {estimate ? (
          <p className="text-sm text-muted-foreground">
            ~{estimate.pending} will receive · {estimate.skipped} skipped ·{" "}
            {estimate.matched_contacts} matched filters
          </p>
        ) : null}
        {estimateMutation.isError ? (
          <p className="text-sm text-destructive">
            {estimateMutation.error instanceof Error
              ? estimateMutation.error.message
              : "Estimate failed"}
          </p>
        ) : null}
      </div>
    </div>
  );
};
