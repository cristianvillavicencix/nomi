import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useGetList, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type OrgFormNotifySettings = {
  id: number;
  default_form_notify_member_ids: number[];
};

export const FormNotificationsSection = () => {
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

  useEffect(() => {
    if (!orgSettings) return;
    setSelectedIds(orgSettings.default_form_notify_member_ids ?? []);
  }, [orgSettings]);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: Number(member.id),
        label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim(),
        email: member.email,
      })),
    [members],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .update({ default_form_notify_member_ids: selectedIds })
        .select("id, default_form_notify_member_ids")
        .single();
      if (error) throw error;
      return data as OrgFormNotifySettings;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["organization-form-notifications"], saved);
      notify("Default form notification recipients saved", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to save form notifications",
        { type: "error" },
      );
    },
  });

  if (!canManage) {
    return null;
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading form notification settings…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form submission notifications</CardTitle>
        <CardDescription>
          These team members receive an SMS by default when a public form is
          submitted. Each form can override this list in its settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {memberOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active team members.</p>
          ) : (
            memberOptions.map((member) => {
              const checked = selectedIds.includes(member.id);
              return (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => {
                      setSelectedIds((current) =>
                        next
                          ? [...new Set([...current, member.id])]
                          : current.filter((id) => id !== member.id),
                      );
                    }}
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{member.label}</span>
                    {member.email ? (
                      <span className="block text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save notification defaults
        </Button>
      </CardContent>
    </Card>
  );
};
