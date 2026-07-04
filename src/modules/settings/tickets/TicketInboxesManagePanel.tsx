import { useState } from "react";
import { useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import {
  useTicketWorkspaceSettingsContext,
  useTicketWorkspaceSettingsMutations,
} from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketInboxesManagePanel = () => {
  const notify = useNotify();
  const { saveMutation } = useTicketWorkspaceSettingsMutations();
  const { data, isPending, patchInbox, saving } =
    useTicketWorkspaceSettingsContext();
  const [newEmail, setNewEmail] = useState("");
  const [newDisplay, setNewDisplay] = useState("");

  const createInbox = async () => {
    if (!newEmail.trim()) return;
    try {
      await saveMutation.mutateAsync({
        create_inbox: {
          email: newEmail.trim(),
          display_name: newDisplay.trim() || null,
        },
      });
      setNewEmail("");
      setNewDisplay("");
      notify("Inbox created", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to create inbox", {
        type: "error",
      });
    }
  };

  if (isPending) return null;

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Inboxes"
        description="Manage support addresses mapped to your organization."
        status={data?.inboxes.length ? "connected" : "partial"}
        meta={`${data?.inboxes.length ?? 0} inbox(es)`}
      />

      <div className="overflow-hidden rounded-lg border text-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(data?.inboxes ?? []).map((inbox) => (
              <tr key={inbox.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{inbox.email}</td>
                <td className="px-3 py-2">{inbox.display_name ?? "—"}</td>
                <td className="px-3 py-2">
                  {inbox.is_default ? (
                    <Badge variant="default" className="text-[10px]">
                      Default
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() =>
                        void patchInbox({ id: inbox.id, is_default: true })
                      }
                    >
                      Set default
                    </Button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Switch
                    checked={inbox.is_active}
                    disabled={saving}
                    onCheckedChange={(checked) =>
                      void patchInbox({ id: inbox.id, is_active: checked })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 rounded-xl border border-dashed p-4">
        <p className="text-sm font-medium">Add inbox</p>
        <p className="text-xs text-muted-foreground">
          After creating, configure DNS and SendGrid under Inbound (SendGrid).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="support@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              value={newDisplay}
              onChange={(e) => setNewDisplay(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" disabled={!newEmail.trim() || saving} onClick={() => void createInbox()}>
          Add inbox
        </Button>
      </section>
    </div>
  );
};
