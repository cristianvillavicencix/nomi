import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const WhatsAppSettingsCard = () => (
  <div className="space-y-4 rounded-xl border border-border/60 p-4">
    <div>
      <h3 className="font-semibold">WhatsApp Business</h3>
      <p className="text-sm text-muted-foreground">Coming soon — shell configuration only.</p>
    </div>
    <Alert>
      <AlertDescription>
        Add WhatsApp Business credentials to activate. Webhook remains in shell mode until enabled.
      </AlertDescription>
    </Alert>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Business Account ID</Label>
        <Input disabled placeholder="Not active yet" />
      </div>
      <div className="space-y-2">
        <Label>Phone Number ID</Label>
        <Input disabled placeholder="Not active yet" />
      </div>
    </div>
  </div>
);
