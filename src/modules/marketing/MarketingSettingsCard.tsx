import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MessagingSettingsPublic } from "@/modules/types";

export const MarketingSettingsCard = () => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messagingServiceSid, setMessagingServiceSid] = useState("");
  const [marketingPhone, setMarketingPhone] = useState("");
  const [marketingEmailFrom, setMarketingEmailFrom] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await dataProvider.getMessagingSettings();
        if (cancelled) return;
        setMessagingServiceSid(
          settings.twilio_marketing_messaging_service_sid ?? "",
        );
        setMarketingPhone(settings.twilio_marketing_phone_number ?? "");
        setMarketingEmailFrom(settings.marketing_email_from ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<MessagingSettingsPublic> = {
        twilio_marketing_messaging_service_sid:
          messagingServiceSid.trim() || null,
        twilio_marketing_phone_number: marketingPhone.trim() || null,
        marketing_email_from: marketingEmailFrom.trim() || null,
      };
      await dataProvider.updateMessagingSettings(payload);
      notify("Marketing settings saved", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Save failed", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketing senders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bulk SMS uses your Twilio marketing Messaging Service (10DLC). Bulk
          email uses Twilio Email with an unsubscribe link. These settings do not
          affect 1:1 Messages or transactional emails.
        </p>
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
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing-phone">Marketing phone (fallback)</Label>
            <Input
              id="marketing-phone"
              value={marketingPhone}
              onChange={(e) => setMarketingPhone(e.target.value)}
              placeholder="10-digit US number"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing-email-from">Marketing email From</Label>
            <Input
              id="marketing-email-from"
              value={marketingEmailFrom}
              onChange={(e) => setMarketingEmailFrom(e.target.value)}
              placeholder="Marketing <news@lbs.bz>"
              disabled={loading}
            />
          </div>
        </div>
        <Button type="button" onClick={handleSave} disabled={loading || saving}>
          Save marketing settings
        </Button>
      </CardContent>
    </Card>
  );
};
