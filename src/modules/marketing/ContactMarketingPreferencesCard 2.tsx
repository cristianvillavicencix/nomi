import { useEffect, useState } from "react";
import { useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ContactMarketingPreferences } from "@/modules/types";

type Props = {
  contactId: number;
  hasNewsletter?: boolean | null;
};

export const ContactMarketingPreferencesCard = ({
  contactId,
  hasNewsletter,
}: Props) => {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<ContactMarketingPreferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("contact_marketing_preferences")
        .select("*")
        .eq("contact_id", contactId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("contact_marketing_preferences", error);
      }
      setPrefs((data as ContactMarketingPreferences | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const smsOptedIn = Boolean(
    prefs?.sms_marketing_opt_in_at && !prefs?.sms_marketing_opt_out_at,
  );
  const emailOptedIn =
    Boolean(
      prefs?.email_marketing_opt_in_at && !prefs?.email_marketing_opt_out_at,
    ) || (hasNewsletter === true && !prefs?.email_marketing_opt_out_at);

  const upsertPrefs = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data: memberRow } = await supabase
        .from("organization_members")
        .select("org_id")
        .limit(1)
        .maybeSingle();

      const orgId = memberRow?.org_id;
      if (!orgId) {
        throw new Error("Organization not found");
      }

      const row = {
        contact_id: contactId,
        org_id: orgId,
        updated_at: now,
        ...patch,
      };

      const { error } = prefs
        ? await supabase
            .from("contact_marketing_preferences")
            .update(row)
            .eq("contact_id", contactId)
        : await supabase.from("contact_marketing_preferences").insert(row);

      if (error) throw error;

      const { data: refreshed } = await supabase
        .from("contact_marketing_preferences")
        .select("*")
        .eq("contact_id", contactId)
        .maybeSingle();

      setPrefs((refreshed as ContactMarketingPreferences | null) ?? null);
      notify("Marketing preferences updated", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Update failed", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSms = async (checked: boolean) => {
    const now = new Date().toISOString();
    if (checked) {
      await upsertPrefs({
        sms_marketing_opt_in_at: now,
        sms_marketing_opt_in_source: "manual",
        sms_marketing_opt_out_at: null,
        sms_marketing_opt_out_reason: null,
      });
    } else {
      await upsertPrefs({
        sms_marketing_opt_out_at: now,
        sms_marketing_opt_out_reason: "manual",
      });
    }
  };

  const toggleEmail = async (checked: boolean) => {
    const now = new Date().toISOString();
    if (checked) {
      await upsertPrefs({
        email_marketing_opt_in_at: now,
        email_marketing_opt_in_source: "manual",
        email_marketing_opt_out_at: null,
        email_marketing_opt_out_reason: null,
      });
      await supabase
        .from("contacts")
        .update({ has_newsletter: true })
        .eq("id", contactId);
    } else {
      await upsertPrefs({
        email_marketing_opt_out_at: now,
        email_marketing_opt_out_reason: "manual",
      });
      await supabase
        .from("contacts")
        .update({ has_newsletter: false })
        .eq("id", contactId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketing opt-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">SMS marketing</p>
            <p className="text-xs text-muted-foreground">
              Required for promotional text blasts.
            </p>
          </div>
          <Switch
            checked={smsOptedIn}
            disabled={loading || saving}
            onCheckedChange={toggleSms}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Email marketing</p>
            <p className="text-xs text-muted-foreground">
              Newsletter and promo email blasts.
            </p>
          </div>
          <Switch
            checked={emailOptedIn}
            disabled={loading || saving}
            onCheckedChange={toggleEmail}
          />
        </div>
        {prefs?.sms_marketing_opt_out_at ? (
          <p className="text-xs text-muted-foreground">
            SMS opted out{" "}
            {new Date(prefs.sms_marketing_opt_out_at).toLocaleString()}
          </p>
        ) : null}
        {prefs?.email_marketing_opt_out_at ? (
          <p className="text-xs text-muted-foreground">
            Email opted out{" "}
            {new Date(prefs.email_marketing_opt_out_at).toLocaleString()}
          </p>
        ) : null}
        {!loading && !smsOptedIn && !emailOptedIn ? (
          <Button type="button" variant="secondary" size="sm" disabled>
            No marketing consent on file
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};
