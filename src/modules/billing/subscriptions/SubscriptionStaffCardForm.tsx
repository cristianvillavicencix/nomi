import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { BillToSelection } from "@/modules/billing/BillToClientSearch";
import {
  readEnvStripePublishableKey,
  resolveStripePublishableKey,
} from "@/modules/billing/stripePublishableKey";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

const stripeElementsAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#2563eb",
    borderRadius: "12px",
    fontFamily: "system-ui, sans-serif",
  },
};

const cardOnlyPaymentElementOptions = {
  layout: {
    type: "accordion" as const,
    defaultCollapsed: false,
    radios: "never" as const,
    spacedAccordionItems: false,
  },
  paymentMethodOrder: ["card"],
  wallets: {
    applePay: "never" as const,
    googlePay: "never" as const,
  },
  terms: {
    card: "never" as const,
  },
};

export type SubscriptionStaffCardFormHandle = {
  confirmCard: () => Promise<string | null>;
};

type SubscriptionStaffCardFormProps = {
  enabled: boolean;
  billTo: BillToSelection | null;
  recipientEmail: string;
};

const SetupForm = forwardRef<
  SubscriptionStaffCardFormHandle,
  { onReadyChange: (ready: boolean) => void }
>(({ onReadyChange }, ref) => {
  const stripe = useStripe();
  const elements = useElements();

  useImperativeHandle(ref, () => ({
    confirmCard: async () => {
      if (!stripe || !elements) {
        throw new Error("Card form is still loading");
      }
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not save card");
      }
      const paymentMethod = result.setupIntent?.payment_method;
      if (typeof paymentMethod === "string") return paymentMethod;
      if (paymentMethod && typeof paymentMethod === "object" && "id" in paymentMethod) {
        return String(paymentMethod.id);
      }
      throw new Error("No payment method returned from Stripe");
    },
  }));

  useEffect(() => {
    onReadyChange(Boolean(stripe && elements));
  }, [stripe, elements, onReadyChange]);

  return (
    <div className="rounded-lg border bg-background p-3">
      <PaymentElement options={cardOnlyPaymentElementOptions} />
    </div>
  );
});

SetupForm.displayName = "SubscriptionStaffCardSetupForm";

const StripeSetupRequiredAlert = () => (
  <Alert>
    <AlertDescription className="space-y-2 text-sm">
      <p>
        Add a Stripe publishable key and turn on{" "}
        <strong>Invoices &amp; payment links</strong> under Settings →
        Integrations → Stripe.
      </p>
      <Link
        to={{
          pathname: "/settings",
          search: `?${buildSettingsSearchParams("connectors", "stripe").toString()}`,
        }}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        Open Stripe settings
        <ExternalLink className="size-3.5" />
      </Link>
    </AlertDescription>
  </Alert>
);

export const SubscriptionStaffCardForm = forwardRef<
  SubscriptionStaffCardFormHandle,
  SubscriptionStaffCardFormProps
>(({ enabled, billTo, recipientEmail }, ref) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const innerRef = useRef<SubscriptionStaffCardFormHandle>(null);
  useImperativeHandle(ref, () => ({
    confirmCard: async () => innerRef.current?.confirmCard() ?? null,
  }));

  const [elementsReady, setElementsReady] = useState(false);

  const stripeSettingsQuery = useQuery({
    queryKey: ["stripeClientSettings"],
    queryFn: () => dataProvider.getStripeClientSettings(),
    enabled: enabled && Boolean(billTo),
    staleTime: 60_000,
  });

  const prepareMutation = useMutation({
    mutationFn: () =>
      dataProvider.prepareClientSubscriptionPayment({
        company_id: billTo?.companyId ?? null,
        contact_id: billTo?.contactId ?? null,
        email_to: recipientEmail || null,
      }),
  });

  useEffect(() => {
    if (!enabled || !billTo || !recipientEmail) {
      prepareMutation.reset();
      return;
    }
    prepareMutation.mutate();
  }, [
    enabled,
    billTo?.companyId,
    billTo?.contactId,
    recipientEmail,
  ]);

  const publishableKey = useMemo(
    () =>
      resolveStripePublishableKey(
        prepareMutation.data?.publishable_key,
        stripeSettingsQuery.data?.stripe_publishable_key,
        readEnvStripePublishableKey(),
      ),
    [
      prepareMutation.data?.publishable_key,
      stripeSettingsQuery.data?.stripe_publishable_key,
    ],
  );

  const stripePromise = useMemo(() => {
    return publishableKey ? loadStripe(publishableKey) : null;
  }, [publishableKey]);

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    const clientSecret = prepareMutation.data?.client_secret?.trim();
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: stripeElementsAppearance,
    };
  }, [prepareMutation.data?.client_secret]);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a client with a valid email to enter a card.
      </p>
    );
  }

  if (!recipientEmail) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a billing email for this client to enter a card.
      </p>
    );
  }

  if (prepareMutation.isPending || stripeSettingsQuery.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Preparing secure card form…
      </div>
    );
  }

  if (prepareMutation.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {(prepareMutation.error as Error).message ||
            "Could not prepare card form"}
        </AlertDescription>
      </Alert>
    );
  }

  if (!elementsOptions) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not prepare the Stripe card form. Check that invoice card
          payments are enabled and the client email is valid.
        </AlertDescription>
      </Alert>
    );
  }

  if (!stripePromise) {
    return <StripeSetupRequiredAlert />;
  }

  return (
    <div className="space-y-2">
      <Elements stripe={stripePromise} options={elementsOptions}>
        <SetupForm ref={innerRef} onReadyChange={setElementsReady} />
      </Elements>
      {!elementsReady ? (
        <p className="text-xs text-muted-foreground">Loading card fields…</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Card is saved securely with Stripe for automatic subscription billing.
        </p>
      )}
    </div>
  );
});

SubscriptionStaffCardForm.displayName = "SubscriptionStaffCardForm";
