import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  BusinessHoursConfig,
  MessagingSettingsPublic,
} from "@/modules/types";
import {
  useTicketWorkspaceSettings,
  useTicketWorkspaceSettingsMutations,
  TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
} from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { hasConfiguredBusinessHours } from "@/modules/shared/organizationBusinessHours";
import {
  resolveBusinessHoursForSave,
  resolveInitialBusinessHours,
} from "@/modules/shared/ticketBusinessHoursMigration";

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
  embedded = false,
}: {
  settings: MessagingSettingsPublic;
  onSave: (
    payload: Partial<MessagingSettingsPublic>,
  ) => Promise<MessagingSettingsPublic> | void;
  saving?: boolean;
  embedded?: boolean;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { data: ticketSettings } = useTicketWorkspaceSettings();
  const { patchWorkspace } = useTicketWorkspaceSettingsMutations();
  const [localSaving, setLocalSaving] = useState(false);

  const initial = useMemo(
    () =>
      resolveInitialBusinessHours(
        settings.business_hours,
        ticketSettings?.workspace,
      ),
    [settings.business_hours, ticketSettings?.workspace],
  );

  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>(
    initial.hours,
  );
  const [importedFromTickets, setImportedFromTickets] = useState(
    initial.importedFromTickets,
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
    const next = resolveInitialBusinessHours(
      settings.business_hours,
      ticketSettings?.workspace,
    );
    setBusinessHours(next.hours);
    setImportedFromTickets(next.importedFromTickets);
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
  }, [settings, ticketSettings?.workspace]);

  const updateDay = (
    key: string,
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setImportedFromTickets(false);
    setBusinessHours((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setLocalSaving(true);
    try {
      const { businessHours: resolvedHours, migratedFromTickets } =
        resolveBusinessHoursForSave(
          businessHours,
          settings.business_hours,
          ticketSettings?.workspace,
        );

      await onSave({
        business_hours: resolvedHours,
        auto_acknowledge_enabled: autoAckEnabled,
        auto_acknowledge_message: autoAckMessage.trim() || null,
        out_of_hours_message: outOfHoursEnabled
          ? outOfHoursMessage.trim() || null
          : null,
      });

      if (hasConfiguredBusinessHours(resolvedHours)) {
        await patchWorkspace({ business_hours_enabled: false });
        await queryClient.invalidateQueries({
          queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
        });
        await queryClient.invalidateQueries({
          queryKey: ["messaging-settings"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["messaging-settings", "business-hours"],
        });
      }

      setImportedFromTickets(false);

      const migratedNotice =
        migratedFromTickets ||
        (importedFromTickets && hasConfiguredBusinessHours(resolvedHours));

      if (migratedNotice) {
        notify(
          "Business hours saved from the legacy Tickets schedule. Ticket fallback disabled.",
          { type: "success" },
        );
      } else {
        notify("Business hours saved", { type: "success" });
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save hours", {
        type: "error",
      });
    } finally {
      setLocalSaving(false);
    }
  };

  const isSaving = saving || localSaving;

  return (
    <div
      className={
        embedded
          ? "w-full space-y-4 border-t pt-6"
          : "w-full space-y-4 rounded-xl border p-4"
      }
    >
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium">Business hours & auto-reply</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared with Calendar, ticket SLA, and inbound SMS auto-replies.
            Configure when your team is available and optional automatic replies
            for inbound SMS.
          </p>
        </div>
      ) : (
        <h4 className="text-sm font-medium">Business hours & auto-reply</h4>
      )}

      {importedFromTickets ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Schedule imported from legacy Tickets settings. Save to apply it here
          and disable the old fallback.
        </p>
      ) : null}

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

      <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
        <Save className="size-4" />
        Save business hours
      </Button>
    </div>
  );
};
