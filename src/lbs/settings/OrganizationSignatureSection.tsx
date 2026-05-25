import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { expandSignature } from "@/lib/signatures/signatureExpansion";
import {
  useOrganizationSmsSignature,
  type OrganizationSmsSignatureSettings,
} from "@/lbs/settings/useOrganizationSmsSignature";

const DEFAULT_TEMPLATE =
  "- {{user_first_name}} {{user_last_name}} | {{org_name}}";

export const OrganizationSignatureSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const canManage = useMemberCapability("admin.settings.manage");
  const {
    data: org,
    isPending,
    signatureContext,
  } = useOrganizationSmsSignature();

  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!org) return;
    setTemplate(org.sms_signature_template ?? DEFAULT_TEMPLATE);
    setEnabled(org.sms_signature_enabled ?? true);
  }, [org]);

  const preview = useMemo(
    () =>
      expandSignature(template, {
        user_first_name: signatureContext.user_first_name,
        user_last_name: signatureContext.user_last_name,
        user_full_name: signatureContext.user_full_name,
        org_name: signatureContext.org_name,
      }),
    [signatureContext, template],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .update({
          sms_signature_template: template.trim() || DEFAULT_TEMPLATE,
          sms_signature_enabled: enabled,
        })
        .select("id, name, sms_signature_template, sms_signature_enabled")
        .single();

      if (error) throw error;
      return data as OrganizationSmsSignatureSettings;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["organization-sms-signature"], saved);
      notify("SMS signature updated for your entire organization", {
        type: "success",
      });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to save SMS signature settings",
        { type: "error" },
      );
    },
  });

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Only administrators with organization settings access can configure the
        SMS signature.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading SMS signature settings…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Signature</CardTitle>
        <CardDescription>
          Automatically appended to the end of each SMS sent to clients.
          <br />
          <strong>
            This signature applies to every user in your organization.
          </strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch
            id="sms-signature-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Label htmlFor="sms-signature-enabled" className="cursor-pointer">
            Enable automatic signature
          </Label>
        </div>

        {enabled ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="sms-signature-template">Signature template</Label>
              <Textarea
                id="sms-signature-template"
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                rows={3}
                maxLength={200}
                placeholder={DEFAULT_TEMPLATE}
              />
              <p className="text-xs text-muted-foreground">
                {template.length}/200 characters
              </p>
            </div>

            <div className="rounded-md bg-muted p-3">
              <p className="mb-2 text-xs font-medium">Available variables:</p>
              <ul className="space-y-1 text-xs">
                <li>
                  <code>{`{{user_first_name}}`}</code> — Sender first name
                </li>
                <li>
                  <code>{`{{user_last_name}}`}</code> — Sender last name
                </li>
                <li>
                  <code>{`{{user_full_name}}`}</code> — Sender full name
                </li>
                <li>
                  <code>{`{{org_name}}`}</code> — Organization name
                </li>
              </ul>
            </div>

            <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <p className="mb-1 text-xs font-medium">
                Preview (as {identity?.fullName ?? "you"}):
              </p>
              <p className="whitespace-pre-line text-sm">
                {`Thanks for reaching out.\n${preview}`}
              </p>
            </div>
          </>
        ) : null}

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
          Save signature
        </Button>
      </CardContent>
    </Card>
  );
};
