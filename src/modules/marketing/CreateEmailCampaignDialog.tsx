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
import type { EmailCampaign, MarketingAudienceFilter } from "@/modules/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const defaultAudience: MarketingAudienceFilter = {
  require_email_opt_in: true,
};

const textToHtml = (text: string) => {
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;">${p
          .split("\n")
          .map((line) =>
            line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;"),
          )
          .join("<br/>")}</p>`,
    )
    .join("");
};

export const CreateEmailCampaignDialog = ({ open, onOpenChange }: Props) => {
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const reset = () => {
    setName("");
    setSubject("");
    setBody("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      notify("Name, subject, and body are required", { type: "warning" });
      return;
    }

    const trimmedBody = body.trim();
    create(
      "email_campaigns",
      {
        data: {
          name: name.trim(),
          subject: subject.trim(),
          body_html: textToHtml(trimmedBody),
          body_text: trimmedBody,
          status: "draft",
          audience_filter: defaultAudience,
        } satisfies Partial<EmailCampaign>,
      },
      {
        onSuccess: () => {
          notify("Email campaign created", { type: "success" });
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
          <DialogTitle>New email campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
