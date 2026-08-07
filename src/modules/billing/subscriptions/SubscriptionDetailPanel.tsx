import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  useDataProvider,
  useGetList,
  useGetMany,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { formatContactName } from "@/modules/billing/billingUtils";
import {
  formatSubscriptionAmountLabel,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";

type SubscriptionDetailPanelProps = {
  subscriptionId: string;
};

export const SubscriptionDetailPanel = ({
  subscriptionId,
}: SubscriptionDetailPanelProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: subscription, isPending } = useGetOne<ClientSubscription>(
    "client_subscriptions",
    { id: subscriptionId },
  );

  const { data: invoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "issue_date", order: "DESC" },
      filter: { "subscription_id@eq": subscriptionId },
    },
    { enabled: Boolean(subscriptionId) },
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription?.company_id ? [subscription.company_id] : [] },
    { enabled: Boolean(subscription?.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription?.contact_id ? [subscription.contact_id] : [] },
    { enabled: Boolean(subscription?.contact_id) },
  );

  const manageMutation = useMutation({
    mutationFn: (action: Parameters<CrmDataProvider["manageClientSubscription"]>[0]["action"]) =>
      dataProvider.manageClientSubscription({
        subscriptionId,
        action,
      }),
    onSuccess: () => {
      refresh();
      notify("Subscription updated", { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update subscription", {
        type: "error",
      });
    },
  });

  if (isPending || !subscription) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const company = companies[0];
  const contact = contacts[0];
  const clientLabel =
    company?.name ?? formatContactName(contact) ?? "Client";
  const canPause = subscription.status === "active";
  const canResume = subscription.status === "paused";
  const canCancel =
    subscription.status === "active" ||
    subscription.status === "past_due" ||
    subscription.status === "paused" ||
    subscription.status === "trialing";
  const canResendSetup = subscription.status === "pending_setup";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{subscription.name}</h2>
            <p className="text-sm text-muted-foreground">{clientLabel}</p>
          </div>
          <Badge variant={subscriptionStatusVariant(subscription.status)}>
            {subscriptionStatusLabel(subscription.status)}
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium">
                {formatSubscriptionAmountLabel(
                  Number(subscription.amount),
                  subscription.currency,
                  subscription.billing_interval,
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Next charge</p>
              <p className="font-medium">
                {formatBillingDate(subscription.next_billing_at?.slice(0, 10))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment method</p>
              <p className="font-medium">
                {subscription.payment_method_last4
                  ? `${subscription.payment_method_brand ?? "Card"} ····${subscription.payment_method_last4}`
                  : "Not on file"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Period end</p>
              <p className="font-medium">
                {formatBillingDate(subscription.current_period_end?.slice(0, 10))}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {canResendSetup ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={manageMutation.isPending}
              onClick={() => manageMutation.mutate("send_setup")}
            >
              Resend setup link
            </Button>
          ) : null}
          {canPause ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={manageMutation.isPending}
              onClick={() => manageMutation.mutate("pause")}
            >
              Pause
            </Button>
          ) : null}
          {canResume ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={manageMutation.isPending}
              onClick={() => manageMutation.mutate("resume")}
            >
              Resume
            </Button>
          ) : null}
          {canCancel ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={manageMutation.isPending}
                onClick={() => manageMutation.mutate("cancel_at_period_end")}
              >
                Cancel at period end
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={manageMutation.isPending}
                onClick={() => manageMutation.mutate("cancel_now")}
              >
                Cancel now
              </Button>
            </>
          ) : null}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Related invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {!invoices.length ? (
              <p className="text-sm text-muted-foreground">
                No invoices from this subscription yet.
              </p>
            ) : (
              <ul className="divide-y">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBillingDate(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <MoneyText value={Number(invoice.amount)} />
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link to={`/billing?invoice=${invoice.id}`}>Open</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
