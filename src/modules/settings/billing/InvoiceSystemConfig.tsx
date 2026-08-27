import { useEffect, useState } from "react";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfigStatus = {
  name: string;
  configured: boolean;
  message?: string;
};

const statusIcon = (configured: boolean) =>
  configured ? (
    <CheckCircle2 className="size-4 text-emerald-500" />
  ) : (
    <XCircle className="size-4 text-destructive" />
  );

export const InvoiceSystemConfig = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<ConfigStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const org = await dataProvider.getOne("organizations", { id: 0 });
        const messaging = await dataProvider.getList(
          "organization_messaging_settings",
          {
            pagination: { page: 1, perPage: 1 },
            sort: { field: "created_at", order: "DESC" },
            filter: {},
          },
        );

        const row = messaging.data[0] as Record<string, unknown> | undefined;

        const stripeConfigured = Boolean(
          org.data.stripe_secret_key_encrypted ||
            org.data.stripe_publishable_key,
        );
        const emailConfigured = Boolean(
          row?.twilio_account_sid && row?.twilio_auth_token,
        );
        const smsConfigured =
          emailConfigured &&
          row?.sms_enabled === true &&
          Boolean(
            row?.twilio_messaging_service_sid || row?.twilio_phone_number,
          );

        setStatuses([
          {
            name: "Stripe payment processing",
            configured: stripeConfigured,
            message: stripeConfigured
              ? "Ready to charge clients"
              : "Add your Stripe keys in Integrations.",
          },
          {
            name: "Email delivery",
            configured: emailConfigured,
            message: emailConfigured
              ? "Ready to send invoices and receipts"
              : "Add Twilio credentials in Integrations.",
          },
          {
            name: "SMS delivery",
            configured: smsConfigured,
            message: smsConfigured
              ? "SMS notifications enabled"
              : "Enable SMS and add a Twilio phone number in Integrations.",
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load config status",
        );
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [dataProvider]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Invoice &amp; Delivery Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : (
          <ul className="space-y-2">
            {statuses.map((status) => (
              <li
                key={status.name}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                  status.configured
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <span className="font-medium">{status.name}</span>
                <div className="flex items-center gap-2 text-right">
                  <span
                    className={cn(
                      "text-xs",
                      status.configured
                        ? "text-emerald-700"
                        : "text-destructive",
                    )}
                  >
                    {status.message}
                  </span>
                  {statusIcon(status.configured)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
