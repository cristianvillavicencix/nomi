import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const VoiceSettingsCard = () => (
  <div className="space-y-4 rounded-xl border border-border/60 p-4">
    <div>
      <h3 className="font-semibold">Voice (Twilio)</h3>
      <p className="text-sm text-muted-foreground">Coming soon — dialer UI is visible but calls are disabled.</p>
    </div>
    <Alert>
      <AlertDescription>
        Add Twilio Voice credentials to activate outbound calling and call history sync.
      </AlertDescription>
    </Alert>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>TwiML App SID</Label>
        <Input disabled placeholder="Not active yet" />
      </div>
      <div className="space-y-2">
        <Label>Outbound Caller ID</Label>
        <Input disabled placeholder="+1…" />
      </div>
    </div>
  </div>
);
