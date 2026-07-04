import { useEffect, useMemo, useState } from "react";
import { useNotify } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import {
  DEFAULT_AUTO_REPLY_SUBJECT,
  DEFAULT_AUTO_REPLY_TEXT,
} from "@/modules/settings/tickets/ticketWorkspaceSettings";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

const loadMembers = async () => {
  const { data, error } = await supabase
    .from("sales")
    .select("organization_member_id, first_name, last_name, email")
    .not("organization_member_id", "is", null)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.organization_member_id as number,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
  }));
};

const memberLabel = (row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
  row.email ||
  "Member";

export const TicketAutomationsPanel = () => {
  const notify = useNotify();
  const { data, patchWorkspace, patchInbox, saving } =
    useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  const inbox = useMemo(
    () => data?.inboxes.find((row) => row.is_default) ?? data?.inboxes[0],
    [data?.inboxes],
  );

  const { data: members = [] } = useQuery({
    queryKey: ["org-members-ticket-settings"],
    queryFn: loadMembers,
  });

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

  const saveInboxAutoReply = async () => {
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
      notify("Automations saved", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Save failed", {
        type: "error",
      });
    }
  };

  if (!workspace) return null;

  return (
    <TicketSettingsPanelShell
      title="Automations"
      description="Auto-replies, defaults for new tickets, contact linking, and round-robin assignment."
    >
      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">Inbound auto-reply</p>
        <IntegrationFeatureSwitchRow
          label="Send acknowledgement on new email tickets"
          description="Uses Twilio Email from your ticket outbound address."
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
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>From name (outbound)</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Auto-reply subject</Label>
          <Input value={autoSubject} onChange={(e) => setAutoSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Auto-reply body</Label>
          <Textarea
            rows={8}
            className="font-mono text-xs"
            value={autoText}
            onChange={(e) => setAutoText(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {"{{ticketId}}"}, {"{{orgName}}"}
          </p>
        </div>
        <Button type="button" size="sm" disabled={saving || !inbox} onClick={() => void saveInboxAutoReply()}>
          Save auto-reply
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">New ticket defaults</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default assignee</Label>
            <Select
              value={
                workspace.default_assignee_member_id
                  ? String(workspace.default_assignee_member_id)
                  : "none"
              }
              onValueChange={(value) =>
                void patchWorkspace({
                  default_assignee_member_id:
                    value === "none" ? null : Number(value),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    {memberLabel(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default priority</Label>
            <Select
              value={workspace.default_priority}
              onValueChange={(value) =>
                void patchWorkspace({
                  default_priority: value as typeof workspace.default_priority,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["low", "normal", "high", "urgent"].map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Initial status</Label>
            <Select
              value={workspace.default_status}
              onValueChange={(value) =>
                void patchWorkspace({
                  default_status: value as typeof workspace.default_status,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="open">Open</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <IntegrationFeatureSwitchRow
          label="Auto-link requester to CRM contact"
          description="When exactly one contact matches the requester email."
          checked={workspace.auto_link_contact}
          disabled={saving}
          onCheckedChange={(checked) =>
            void patchWorkspace({ auto_link_contact: checked })
          }
        />
        <IntegrationFeatureSwitchRow
          label="Round-robin assignment"
          description="Rotate assignee across selected team members for new inbound tickets."
          checked={workspace.round_robin_enabled}
          disabled={saving}
          onCheckedChange={(checked) =>
            void patchWorkspace({ round_robin_enabled: checked })
          }
        />
        {workspace.round_robin_enabled ? (
          <div className="space-y-2">
            <Label>Round-robin members (comma-separated member IDs)</Label>
            <Input
              value={workspace.round_robin_member_ids.join(", ")}
              onChange={(e) => {
                const ids = e.target.value
                  .split(",")
                  .map((part) => Number(part.trim()))
                  .filter((id) => id > 0);
                void patchWorkspace({ round_robin_member_ids: ids });
              }}
            />
          </div>
        ) : null}
      </section>
    </TicketSettingsPanelShell>
  );
};
