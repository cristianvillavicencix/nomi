import { useEffect, useMemo, useState } from "react";
import { useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import {
  DEFAULT_AUTO_REPLY_SUBJECT,
  DEFAULT_AUTO_REPLY_TEXT,
} from "@/modules/settings/tickets/ticketWorkspaceSettings";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketAutoReplySection = () => {
  const notify = useNotify();
  const { data, patchInbox, saving } = useTicketWorkspaceSettingsContext();
  const inbox = useMemo(
    () => data?.inboxes.find((row) => row.is_default) ?? data?.inboxes[0],
    [data?.inboxes],
  );

  const [autoSubject, setAutoSubject] = useState("");
  const [autoText, setAutoText] = useState("");
  const [fromName, setFromName] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!inbox) return;
    setAutoSubject(inbox.auto_reply_subject ?? DEFAULT_AUTO_REPLY_SUBJECT);
    setAutoText(inbox.auto_reply_text ?? DEFAULT_AUTO_REPLY_TEXT);
    setFromName(inbox.from_name ?? "");
    setDisplayName(inbox.display_name ?? "");
  }, [inbox]);

  const save = async () => {
    if (!inbox) return;
    try {
      await patchInbox({
        id: inbox.id,
        auto_reply_subject: autoSubject.trim() || null,
        auto_reply_text: autoText.trim() || null,
        auto_reply_html: null,
        from_name: fromName.trim() || null,
        display_name: displayName.trim() || null,
      });
      notify("Auto-reply saved", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Save failed", {
        type: "error",
      });
    }
  };

  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Auto-reply on new email</p>
        <p className="text-xs text-muted-foreground">
          Sent automatically when a client opens a new ticket by email.
        </p>
      </div>
      <IntegrationFeatureSwitchRow
        label="Send acknowledgement"
        checked={inbox?.auto_reply_enabled !== false}
        disabled={saving || !inbox}
        onCheckedChange={(checked) => {
          if (!inbox) return;
          void patchInbox({ id: inbox.id, auto_reply_enabled: checked });
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Display name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>From name</Label>
          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Subject</Label>
        <Input value={autoSubject} onChange={(e) => setAutoSubject(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Body</Label>
        <Textarea
          rows={6}
          className="font-mono text-xs"
          value={autoText}
          onChange={(e) => setAutoText(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Variables: {"{{ticketId}}"}, {"{{orgName}}"}
        </p>
      </div>
      <Button type="button" size="sm" disabled={saving || !inbox} onClick={() => void save()}>
        Save auto-reply
      </Button>
    </section>
  );
};
