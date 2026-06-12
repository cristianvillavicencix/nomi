import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Twilio Voice dialer shell — UI only until voice_token is configured. */
export const DialerPanel = ({ onClose }: { onClose?: () => void }) => (
  <div className="rounded-xl border border-border/60 bg-background p-4 shadow-lg">
    <div className="mb-3 flex items-center justify-between">
      <div className="font-semibold">Dialer</div>
      {onClose ? (
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      ) : null}
    </div>
    <Input
      placeholder="+1 (555) 000-0000"
      className="mb-3 text-center text-lg tracking-widest"
    />
    <div className="grid grid-cols-3 gap-2 text-center">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
        (key) => (
          <Button key={key} variant="outline" size="sm" className="h-10">
            {key}
          </Button>
        ),
      )}
    </div>
    <Button
      className="mt-4 w-full"
      disabled
      title="Voice not configured in Settings → Communications"
    >
      <Phone className="mr-2 size-4" />
      Call
    </Button>
    <p className="mt-2 text-center text-xs text-muted-foreground">
      Twilio Voice is not active yet. Add credentials in Settings →
      Communications.
    </p>
  </div>
);
