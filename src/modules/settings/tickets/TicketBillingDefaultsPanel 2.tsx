import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DELIVERABLE_BILLING_OPTIONS } from "@/modules/tickets/supplementPricing";
import { TicketSettingsPanelShell } from "@/modules/settings/tickets/TicketSettingsPanelShell";
import { useTicketWorkspaceSettingsContext } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const TicketBillingDefaultsPanel = () => {
  const { data, patchWorkspace, saving } = useTicketWorkspaceSettingsContext();
  const workspace = data?.workspace;
  if (!workspace) return null;

  return (
    <TicketSettingsPanelShell
      title="Billing defaults"
      description="Defaults when invoicing from tickets. Package prices live in Products → Service catalog."
    >
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <div className="space-y-2">
          <Label>Default deliverable type</Label>
          <Select
            value={workspace.default_billing_kind ?? "none"}
            onValueChange={(value) =>
              void patchWorkspace({
                default_billing_kind: value === "none" ? null : value,
              })
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {DELIVERABLE_BILLING_OPTIONS.map((option) => (
                <SelectItem key={option.kind} value={option.kind}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Default transfer fee ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={workspace.default_transfer_fee ?? ""}
            placeholder="Use catalog default"
            onChange={(e) => {
              const raw = e.target.value.trim();
              void patchWorkspace({
                default_transfer_fee: raw ? Number(raw) : null,
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Invoice reminder cadence (days)</Label>
          <Input
            type="number"
            min={0}
            value={workspace.invoice_reminder_days ?? ""}
            placeholder="Disabled"
            onChange={(e) => {
              const raw = e.target.value.trim();
              void patchWorkspace({
                invoice_reminder_days: raw ? Number(raw) : null,
              });
            }}
          />
        </div>
      </section>
    </TicketSettingsPanelShell>
  );
};
