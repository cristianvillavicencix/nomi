import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetIdentity, useGetOne, useNotify } from "ra-core";
import { useEffect, useState } from "react";

import type { OrganizationMember } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Input } from "@/components/ui/input";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { isValidE164 } from "@/lib/e164";
import {
  SettingsRows,
  SettingsSection,
} from "@/modules/settings/SettingsSection";

import { NotificationSettingsRow } from "./NotificationSettingsRow";

const inlineInputClass =
  "h-9 w-44 border-0 border-b border-transparent bg-transparent px-0 shadow-none rounded-none focus-visible:border-border focus-visible:ring-0 sm:w-52";

export const PersonalSmsPhonePanel = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { data: member, refetch } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: identity?.id },
    { enabled: identity?.id != null },
  );

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setPhone(member?.notification_phone ?? "");
    setTouched(false);
  }, [member?.notification_phone]);

  const saveMutation = useMutation({
    mutationFn: async (nextPhone: string) => {
      if (!member?.id) throw new Error("Member not found");
      const trimmed = nextPhone.trim();
      const value = trimmed === "" ? null : trimmed;
      if (value && !isValidE164(value)) {
        throw new Error("Invalid phone format. Use E.164, e.g. +12035551234");
      }
      const { error } = await supabase
        .from("organization_members")
        .update({ notification_phone: value })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void refetch();
      notify("Notification phone updated", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save phone", {
        type: "error",
      });
    },
    onSettled: () => setSaving(false),
  });

  const trimmed = phone.trim();
  const canSave = trimmed === "" || isValidE164(trimmed);
  const showInvalid = trimmed.length > 0 && !isValidE164(trimmed);

  useDebouncedSave(
    phone,
    (next) => {
      if (!canSave) return;
      setSaving(true);
      saveMutation.mutate(next);
    },
    { enabled: touched && Boolean(member?.id) && canSave, delayMs: 700 },
  );

  if (!identity) return null;

  return (
    <SettingsSection title="SMS alerts">
      <SettingsRows>
        <NotificationSettingsRow
          label="Notification phone"
          hint="E.164 format, e.g. +12035551234. Used for form and task SMS alerts."
          control={
            <div className="flex items-center gap-2">
              {saving ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <Input
                id="notification-phone"
                type="tel"
                className={inlineInputClass}
                value={phone}
                onChange={(event) => {
                  setTouched(true);
                  setPhone(event.target.value);
                }}
                placeholder="+12035551234"
                autoComplete="tel"
              />
            </div>
          }
        />
        <NotificationSettingsRow
          label="Account email"
          control={
            <span className="text-sm text-muted-foreground">
              {member?.email ?? "—"}
            </span>
          }
        />
      </SettingsRows>
      {showInvalid ? (
        <p className="pt-1 text-xs text-destructive">
          Invalid format. Use +12035551234.
        </p>
      ) : null}
    </SettingsSection>
  );
};
