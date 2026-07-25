import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
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

export const TicketNewTicketDefaultsSection = () => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;

  const { data: members = [] } = useQuery({
    queryKey: ["org-members-ticket-settings"],
    queryFn: loadMembers,
  });

  if (!workspace) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">New ticket defaults</p>
        <p className="text-xs text-muted-foreground">
          Applied when tickets are created from inbound email.
        </p>
      </div>
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
        checked={workspace.auto_link_contact}
        disabled={saving}
        onCheckedChange={(checked) =>
          void patchWorkspace({ auto_link_contact: checked })
        }
      />
      <IntegrationFeatureSwitchRow
        label="Round-robin assignment"
        checked={workspace.round_robin_enabled}
        disabled={saving}
        onCheckedChange={(checked) =>
          void patchWorkspace({ round_robin_enabled: checked })
        }
      />
      {workspace.round_robin_enabled ? (
        <div className="space-y-2">
          <Label>Round-robin member IDs (comma-separated)</Label>
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
  );
};
