import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, Save, Send } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useDataProvider } from "ra-core";

export type EmailDeliverySettings = {
  configured: boolean;
  provider: "twilio" | null;
  from_email: string | null;
  reply_to: string | null;
  org_name: string | null;
};

export const EmailDeliverySettingsSection = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const { data, isPending, error } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: isAdmin,
  });

  const [replyTo, setReplyTo] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setReplyTo(data.reply_to ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      dataProvider.updateEmailDeliverySettings({
        reply_to: replyTo.trim() || null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["email-delivery-settings"], saved);
      notify("Reply-to email saved", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save email settings",
        { type: "error" },
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: () => dataProvider.sendTestTransactionalEmail(testEmail.trim()),
    onSuccess: () => {
      notify("Test email sent", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to send test email",
        { type: "error" },
      );
    },
  });

  if (!isAdmin) return null;

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading email delivery settings…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load email delivery settings.
      </p>
    );
  }

  const providerLabel =
    data?.provider === "twilio" ? "Twilio SendGrid" : "Not configured";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" />
          Transactional email
        </CardTitle>
        <CardDescription>
          Outbound email for invoices, portal verification codes, and web audit
          reports. Uses Twilio SendGrid (same Twilio account as SMS). API keys
          are configured on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data?.configured ? (
          <Alert>
            <AlertDescription>
              Set <code className="text-xs">TWILIO_SENDGRID_API_KEY</code> and{" "}
              <code className="text-xs">TWILIO_SENDGRID_FROM_EMAIL</code> in
              Supabase Edge Function secrets. Create the API key in Twilio
              Console → Email → SendGrid.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={data?.configured ? "default" : "secondary"}>
            {data?.configured ? (
              <>
                <CheckCircle2 className="mr-1 size-3.5" />
                Ready to send
              </>
            ) : (
              "Not configured"
            )}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Provider: {providerLabel}
          </span>
        </div>

        {data?.from_email ? (
          <p className="text-sm text-muted-foreground">
            From address:{" "}
            <span className="font-medium text-foreground">{data.from_email}</span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-reply-to">Reply-to email</Label>
            <Input
              id="email-reply-to"
              type="email"
              value={replyTo}
              onChange={(event) => setReplyTo(event.target.value)}
              placeholder="billing@yourcompany.com"
            />
            <p className="text-xs text-muted-foreground">
              Client replies to invoices and notifications go to this address.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-test-to">Send test email</Label>
            <div className="flex gap-2">
              <Input
                id="email-test-to"
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={!data?.configured || testMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  !data?.configured ||
                  !testEmail.trim() ||
                  testMutation.isPending
                }
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save reply-to
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
