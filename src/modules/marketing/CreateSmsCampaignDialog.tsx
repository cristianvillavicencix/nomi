import { useState } from "react";
import { useCreate, useNotify } from "ra-core";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { MarketingAudienceFilter, SmsCampaign } from "@/modules/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const defaultAudience: MarketingAudienceFilter = {
  require_sms_opt_in: true,
};

export const CreateSmsCampaignDialog = ({ open, onOpenChange }: Props) => {
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [includeStopFooter, setIncludeStopFooter] = useState(true);

  const reset = () => {
    setName("");
    setBody("");
    setIncludeStopFooter(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !body.trim()) {
      notify("Name and message are required", { type: "warning" });
      return;
    }

    create(
      "sms_campaigns",
      {
        data: {
          name: name.trim(),
          body: body.trim(),
          status: "draft",
          audience_filter: defaultAudience,
          include_stop_footer: includeStopFooter,
        } satisfies Partial<SmsCampaign>,
      },
      {
        onSuccess: () => {
          notify("SMS campaign created", { type: "success" });
          reset();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New SMS campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              rows={5}
              placeholder="Your promotional message…"
            />
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
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
