import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MessagingSettingsPublic } from "@/modules/types";

export const MarketingSettingsCard = ({
  settings,
  onSave,
  saving,
}: {
  settings: MessagingSettingsPublic;
  onSave: (payload: Partial<MessagingSettingsPublic>) => void;
  saving?: boolean;
}) => {
  const [messagingServiceSid, setMessagingServiceSid] = useState("");
  const [marketingPhone, setMarketingPhone] = useState("");
  const [marketingEmailFrom, setMarketingEmailFrom] = useState("");

  useEffect(() => {
    setMessagingServiceSid(
      settings.twilio_marketing_messaging_service_sid ?? "",
    );
    setMarketingPhone(settings.twilio_marketing_phone_number ?? "");
    setMarketingEmailFrom(settings.marketing_email_from ?? "");
  }, [settings]);

  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-medium">Marketing campaigns</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk SMS and email blasts use separate senders from 1:1 Messages and
          transactional invoice or ticket email. Configure your Twilio marketing
          Messaging Service (10DLC) here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="marketing-messaging-service-sid">
            Twilio Marketing Messaging Service SID
          </Label>
          <Input
            id="marketing-messaging-service-sid"
            value={messagingServiceSid}
            onChange={(e) => setMessagingServiceSid(e.target.value)}
            placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-phone">Marketing phone (fallback)</Label>
          <Input
            id="marketing-phone"
            value={marketingPhone}
            onChange={(e) => setMarketingPhone(e.target.value)}
            placeholder="(555) 123-4567"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Used only when no Messaging Service SID is set.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-email-from">Marketing email From</Label>
          <Input
            id="marketing-email-from"
            value={marketingEmailFrom}
            onChange={(e) => setMarketingEmailFrom(e.target.value)}
            placeholder="Marketing <news@lbs.bz>"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Optional override for bulk email. Unsubscribe links are added
            automatically.
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={() =>
          onSave({
            twilio_marketing_messaging_service_sid:
              messagingServiceSid.trim() || null,
            twilio_marketing_phone_number: marketingPhone.trim() || null,
            marketing_email_from: marketingEmailFrom.trim() || null,
          })
        }
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        Save marketing settings
      </Button>
    </div>
  );
};
