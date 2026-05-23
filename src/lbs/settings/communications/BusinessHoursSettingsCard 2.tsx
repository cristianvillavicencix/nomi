import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessHoursConfig, MessagingSettingsPublic } from "@/lbs/types";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export const BusinessHoursSettingsCard = ({
  settings,
  onSave,
  saving,
}: {
  settings: MessagingSettingsPublic;
  onSave: (payload: Partial<MessagingSettingsPublic>) => void;
  saving?: boolean;
}) => {
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>(
    settings.business_hours ?? {},
  );
  const [autoAckEnabled, setAutoAckEnabled] = useState(
    settings.auto_acknowledge_enabled ?? false,
  );
  const [autoAckMessage, setAutoAckMessage] = useState(
    settings.auto_acknowledge_message ??
      "Thanks {{client_name}} — we received your message and will reply soon.",
  );
  const [outOfHoursEnabled, setOutOfHoursEnabled] = useState(
    Boolean(settings.out_of_hours_message),
  );
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    settings.out_of_hours_message ??
      "We are currently outside business hours. We will get back to you on the next business day.",
  );

  useEffect(() => {
    setBusinessHours(settings.business_hours ?? {});
    setAutoAckEnabled(settings.auto_acknowledge_enabled ?? false);
    setAutoAckMessage(
      settings.auto_acknowledge_message ??
        "Thanks {{client_name}} — we received your message and will reply soon.",
    );
    setOutOfHoursEnabled(Boolean(settings.out_of_hours_message));
    setOutOfHoursMessage(
      settings.out_of_hours_message ??
        "We are currently outside business hours. We will get back to you on the next business day.",
    );
  }, [settings]);

  const updateDay = (
    key: string,
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setBusinessHours((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-medium">Business hours & auto-reply</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure when your team is available and optional automatic replies
          for inbound SMS.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map((day) => {
          const entry = businessHours[day.key] ?? {};
          return (
            <div
              key={day.key}
              className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-2"
            >
              <span className="text-sm">{day.label}</span>
              <Input
                type="time"
                value={entry.open ?? "09:00"}
                disabled={entry.closed}
                onChange={(event) =>
                  updateDay(day.key, "open", event.target.value)
                }
              />
              <Input
                type="time"
                value={entry.close ?? "18:00"}
                disabled={entry.closed}
                onChange={(event) =>
                  updateDay(day.key, "close", event.target.value)
                }
              />
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={entry.closed === true}
                  onCheckedChange={(checked) =>
                    updateDay(day.key, "closed", checked === true)
                  }
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={autoAckEnabled}
          onCheckedChange={(checked) => setAutoAckEnabled(checked === true)}
        />
        Auto-acknowledge new inbound messages
      </label>
      <Textarea
        value={autoAckMessage}
        onChange={(event) => setAutoAckMessage(event.target.value)}
        rows={3}
        disabled={!autoAckEnabled}
      />

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={outOfHoursEnabled}
          onCheckedChange={(checked) => setOutOfHoursEnabled(checked === true)}
        />
        Send out-of-hours auto-reply
      </label>
      <Textarea
        value={outOfHoursMessage}
        onChange={(event) => setOutOfHoursMessage(event.target.value)}
        rows={3}
        disabled={!outOfHoursEnabled}
      />

      <Button
        type="button"
        onClick={() =>
          onSave({
            business_hours: businessHours,
            auto_acknowledge_enabled: autoAckEnabled,
            auto_acknowledge_message: autoAckMessage.trim() || null,
            out_of_hours_message: outOfHoursEnabled
              ? outOfHoursMessage.trim() || null
              : null,
          })
        }
        disabled={saving}
      >
        <Save className="size-4" />
        Save business hours
      </Button>
    </div>
  );
};
