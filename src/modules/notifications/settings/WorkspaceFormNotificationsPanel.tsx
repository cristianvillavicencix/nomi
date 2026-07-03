import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetList, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";

import type { OrganizationMember } from "@/components/atomic-crm/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { hasConfiguredNotificationPhone } from "@/modules/settings/MemberPhoneStatus";
import { Switch } from "@/components/ui/switch";
import {
  SettingsRows,
  SettingsSection,
} from "@/modules/settings/SettingsSection";

import { NotificationSettingsRow } from "./NotificationSettingsRow";

type OrgFormNotifySettings = {
  id: number;
  default_form_notify_member_ids: number[];
};

export const WorkspaceFormNotificationsPanel = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const canManage = useMemberCapability("admin.settings.manage");

  const { data: orgSettings, isPending } = useQuery({
    queryKey: ["organization-form-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, default_form_notify_member_ids")
        .single();
      if (error) throw error;
      return data as OrgFormNotifySettings;
    },
    enabled: canManage,
  });

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter: { "disabled@eq": false },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: canManage },
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (!orgSettings) return;
    setSelectedIds(
      (orgSettings.default_form_notify_member_ids ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
  }, [orgSettings]);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: Number(member.id),
        label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim(),
        email: member.email,
        notification_phone: member.notification_phone,
      })),
    [members],
  );

  const selectedWithoutPhone = useMemo(
    () =>
      memberOptions.filter(
        (member) =>
          selectedIds.includes(member.id) &&
          !hasConfiguredNotificationPhone(member.notification_phone),
      ),
    [memberOptions, selectedIds],
  );

  const saveMutation = useMutation({
    mutationFn: async (memberIds: number[]) => {
      if (orgSettings?.id == null) {
        throw new Error("Organization not loaded");
      }

      const normalized = [
        ...new Set(
          memberIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ];

      const { data, error } = await supabase
        .from("organizations")
        .update({ default_form_notify_member_ids: normalized })
        .eq("id", orgSettings.id)
        .select("id, default_form_notify_member_ids")
        .single();
      if (error) throw error;
      return data as OrgFormNotifySettings;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["organization-form-notifications"], saved);
      notify("Form notification defaults updated", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to save form notifications",
        { type: "error" },
      );
    },
    onSettled: () => setSavingId(null),
  });

  const toggleMember = (memberId: number, enabled: boolean) => {
    const next = enabled
      ? [...new Set([...selectedIds, memberId])]
      : selectedIds.filter((id) => id !== memberId);
    setSelectedIds(next);
    setSavingId(memberId);
    saveMutation.mutate(next);
  };

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">Administrators only.</p>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <SettingsSection title="Form submission SMS">
      {selectedWithoutPhone.length > 0 ? (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          {selectedWithoutPhone.length} selected without an SMS phone.
        </p>
      ) : null}
      {memberOptions.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No active team members.
        </p>
      ) : (
        <SettingsRows>
          {memberOptions.map((member) => {
            const checked = selectedIds.includes(member.id);
            const busy = savingId === member.id && saveMutation.isPending;
            const missingPhone =
              checked &&
              !hasConfiguredNotificationPhone(member.notification_phone);
            return (
              <NotificationSettingsRow
                key={member.id}
                label={member.label || member.email || `Member #${member.id}`}
                hint={
                  missingPhone
                    ? "No SMS phone on file — set under Personal → SMS alerts."
                    : member.email && member.label
                      ? member.email
                      : undefined
                }
                control={
                  busy ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={checked}
                      disabled={saveMutation.isPending}
                      onCheckedChange={(next) =>
                        toggleMember(member.id, next)
                      }
                    />
                  )
                }
              />
            );
          })}
        </SettingsRows>
      )}
    </SettingsSection>
  );
};
