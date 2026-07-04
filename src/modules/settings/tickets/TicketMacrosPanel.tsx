import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketMacrosPanel = ({ embedded }: { embedded?: boolean }) => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");

  if (!workspace) return null;

  const addMacro = () => {
    if (!label.trim()) return;
    void patchWorkspace({
      macros: [
        ...workspace.macros,
        {
          id: crypto.randomUUID(),
          label: label.trim(),
          status: status.trim() || null,
          reply_template_id: null,
          internal_note: note.trim() || null,
        },
      ],
    });
    setLabel("");
    setStatus("");
    setNote("");
  };

  const body = (
    <>
      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Set status (optional)</Label>
          <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="waiting" />
        </div>
        <div className="space-y-2">
          <Label>Internal note (optional)</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="button" size="sm" disabled={saving} onClick={addMacro}>
          <Plus className="mr-1 size-4" />
          Add macro
        </Button>
      </section>

      <ul className="space-y-2 text-sm">
        {workspace.macros.map((macro) => (
          <li key={macro.id} className="flex items-start justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="font-medium">{macro.label}</p>
              {macro.status ? (
                <p className="text-xs text-muted-foreground">Status → {macro.status}</p>
              ) : null}
              {macro.internal_note ? (
                <p className="text-xs text-muted-foreground">{macro.internal_note}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() =>
                void patchWorkspace({
                  macros: workspace.macros.filter((entry) => entry.id !== macro.id),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return (
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Macros</p>
          <p className="text-xs text-muted-foreground">
            Saved actions for staff (status + internal note).
          </p>
        </div>
        <div className="space-y-4">{body}</div>
      </section>
    );
  }

  return (
    <TicketSettingsPanelShell
      title="Macros"
      description="Saved actions for staff (status + internal note). Composer integration coming next."
    >
      {body}
    </TicketSettingsPanelShell>
  );
};
