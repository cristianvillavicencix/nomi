import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useNotify } from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  DEFAULT_ORGANIZATION_LEAD_SETTINGS,
  normalizeOrganizationLeadSettings,
  type OrganizationLeadSettings,
} from "@/modules/leads/leadWorkspaceSettings";
import {
  useOrganizationLeadSettings,
  type OrganizationLeadSettingsRow,
} from "@/modules/settings/useOrganizationLeadSettings";

export const InboundLeadAutomationPanel = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const canManage = useMemberCapability("admin.settings.manage");
  const { data: org, isPending } = useOrganizationLeadSettings();

  const [settings, setSettings] = useState<OrganizationLeadSettings>(
    DEFAULT_ORGANIZATION_LEAD_SETTINGS,
  );

  useEffect(() => {
    if (!org) return;
    setSettings({
      auto_create_deal_from_web: org.auto_create_deal_from_web,
      allow_form_auto_create_deal: org.allow_form_auto_create_deal,
    });
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (org?.id == null) {
        throw new Error("Organization not loaded");
      }

      const { data, error } = await supabase
        .from("organizations")
        .update({ lead_settings: settings })
        .eq("id", org.id)
        .select("id, name, lead_settings")
        .single();

      if (error) throw error;
      return data as {
        id: number;
        name?: string | null;
        lead_settings: unknown;
      };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["organization-lead-settings"], {
        id: saved.id,
        name: saved.name,
        ...normalizeOrganizationLeadSettings(saved.lead_settings),
      } satisfies OrganizationLeadSettingsRow);
      notify("Lead automation settings saved", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to save lead automation settings",
        { type: "error" },
      );
    },
  });

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Only administrators with organization settings access can configure
        inbound lead automation.
      </div>
    );
  }

  if (isPending || !org) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading lead automation settings…
      </div>
    );
  }

  const dirty =
    settings.auto_create_deal_from_web !== org.auto_create_deal_from_web ||
    settings.allow_form_auto_create_deal !== org.allow_form_auto_create_deal;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbound lead automation</CardTitle>
        <CardDescription>
          Control whether website and form submissions create a project
          automatically. By default, new inbound leads stay in Pipeline only;
          projects are created manually when you qualify the lead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label htmlFor="auto-create-deal-web">
              Auto-create opportunity from website (lbs.bz)
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, webhook leads with a tool or quote request also
              create a pre-sale opportunity in Projects. When off, only the
              Pipeline contact is created.
            </p>
          </div>
          <Switch
            id="auto-create-deal-web"
            checked={settings.auto_create_deal_from_web}
            onCheckedChange={(checked) =>
              setSettings((current) => ({
                ...current,
                auto_create_deal_from_web: checked,
              }))
            }
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label htmlFor="allow-form-auto-deal">
              Allow forms to auto-create opportunities
            </Label>
            <p className="text-xs text-muted-foreground">
              When off, form submissions never create Projects—even if an
              individual form has &quot;Auto-create opportunity&quot; enabled.
              When on, each form controls its own behavior.
            </p>
          </div>
          <Switch
            id="allow-form-auto-deal"
            checked={settings.allow_form_auto_create_deal}
            onCheckedChange={(checked) =>
              setSettings((current) => ({
                ...current,
                allow_form_auto_create_deal: checked,
              }))
            }
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
