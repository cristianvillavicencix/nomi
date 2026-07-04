import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

const loadMembers = async () => {
  const { data, error } = await supabase
    .from("sales")
    .select("organization_member_id, first_name, last_name")
    .not("organization_member_id", "is", null)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.organization_member_id as number,
    first_name: row.first_name,
    last_name: row.last_name,
  }));
};

export const TicketSpamRoutingPanel = () => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  const [allowedDraft, setAllowedDraft] = useState("");
  const [blockedDraft, setBlockedDraft] = useState("");
  const [ruleSubject, setRuleSubject] = useState("");
  const [ruleAssignee, setRuleAssignee] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["org-members-routing"],
    queryFn: loadMembers,
  });

  if (!workspace) return null;

  const pushDomain = (list: "allowed" | "blocked", domain: string) => {
    const value = domain.trim().toLowerCase();
    if (!value) return;
    if (list === "allowed") {
      if (workspace.allowed_inbound_domains.includes(value)) return;
      void patchWorkspace({
        allowed_inbound_domains: [...workspace.allowed_inbound_domains, value],
      });
      setAllowedDraft("");
      return;
    }
    if (workspace.blocked_inbound_domains.includes(value)) return;
    void patchWorkspace({
      blocked_inbound_domains: [...workspace.blocked_inbound_domains, value],
    });
    setBlockedDraft("");
  };

  const addRoutingRule = () => {
    const needle = ruleSubject.trim();
    if (!needle) return;
    void patchWorkspace({
      routing_rules: [
        ...workspace.routing_rules,
        {
          id: crypto.randomUUID(),
          match_subject_contains: needle,
          assignee_member_id: ruleAssignee ? Number(ruleAssignee) : null,
          priority: null,
          tag: null,
        },
      ],
    });
    setRuleSubject("");
    setRuleAssignee("");
  };

  return (
    <TicketSettingsPanelShell
      title="Spam & routing"
      description="Filter inbound senders and route tickets by subject keywords."
    >
      <IntegrationFeatureSwitchRow
        label="Ignore auto-responders and mailer-daemon"
        checked={workspace.ignore_auto_responders}
        disabled={saving}
        onCheckedChange={(checked) =>
          void patchWorkspace({ ignore_auto_responders: checked })
        }
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border p-3">
          <Label>Allowed sender domains</Label>
          <p className="text-[11px] text-muted-foreground">Empty = allow all</p>
          <div className="flex gap-2">
            <Input
              value={allowedDraft}
              onChange={(e) => setAllowedDraft(e.target.value)}
              placeholder="client.com"
            />
            <Button type="button" variant="outline" onClick={() => pushDomain("allowed", allowedDraft)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <DomainList
            domains={workspace.allowed_inbound_domains}
            onRemove={(domain) =>
              void patchWorkspace({
                allowed_inbound_domains: workspace.allowed_inbound_domains.filter(
                  (entry) => entry !== domain,
                ),
              })
            }
          />
        </div>
        <div className="space-y-2 rounded-xl border p-3">
          <Label>Blocked sender domains</Label>
          <div className="flex gap-2">
            <Input
              value={blockedDraft}
              onChange={(e) => setBlockedDraft(e.target.value)}
              placeholder="spam.net"
            />
            <Button type="button" variant="outline" onClick={() => pushDomain("blocked", blockedDraft)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <DomainList
            domains={workspace.blocked_inbound_domains}
            onRemove={(domain) =>
              void patchWorkspace({
                blocked_inbound_domains: workspace.blocked_inbound_domains.filter(
                  (entry) => entry !== domain,
                ),
              })
            }
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm font-medium">Subject routing rules</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={ruleSubject}
            onChange={(e) => setRuleSubject(e.target.value)}
            placeholder="Subject contains…"
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={ruleAssignee}
            onChange={(e) => setRuleAssignee(e.target.value)}
          >
            <option value="">No assignee override</option>
            {members.map((member) => (
              <option key={member.id} value={String(member.id)}>
                {[member.first_name, member.last_name].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRoutingRule}>
          Add rule
        </Button>
        <ul className="space-y-1 text-xs">
          {workspace.routing_rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between rounded border px-2 py-1">
              <span>
                &quot;{rule.match_subject_contains}&quot;
                {rule.assignee_member_id
                  ? ` → member #${rule.assignee_member_id}`
                  : ""}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  void patchWorkspace({
                    routing_rules: workspace.routing_rules.filter(
                      (entry) => entry.id !== rule.id,
                    ),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </TicketSettingsPanelShell>
  );
};

const DomainList = ({
  domains,
  onRemove,
}: {
  domains: string[];
  onRemove: (domain: string) => void;
}) => (
  <ul className="space-y-1 text-xs">
    {domains.map((domain) => (
      <li key={domain} className="flex items-center justify-between rounded border px-2 py-1">
        {domain}
        <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(domain)}>
          <Trash2 className="size-3.5" />
        </Button>
      </li>
    ))}
  </ul>
);
