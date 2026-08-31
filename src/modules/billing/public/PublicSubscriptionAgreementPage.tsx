import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { resolvePublicAppBaseUrl } from "@/lib/publicAppUrl";
import {
  fetchPublicSubscriptionAgreement,
  signPublicSubscriptionAgreement,
} from "@/modules/billing/public/publicSubscriptionAgreementApi";
import { formatSubscriptionAmountLabel } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

const shellClassName =
  "mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-5 bg-slate-50 px-4 py-8";

const lineTotal = (row: Record<string, unknown>) => {
  const qty = Number(row.quantity ?? 1) || 1;
  const unit = Number(row.unit_price ?? 0) || 0;
  return qty * unit;
};

/** Public `/sub-agree/:shortCode` — terms, draw signature, then Stripe card setup. */
export const PublicSubscriptionAgreementPage = () => {
  const { shortCode = "" } = useParams();
  const [searchParams] = useSearchParams();
  const cardStatus = searchParams.get("card");

  const [agreed, setAgreed] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [signaturePng, setSignaturePng] = useState("");

  const agreementQuery = useQuery({
    queryKey: ["public-subscription-agreement", shortCode],
    queryFn: () => fetchPublicSubscriptionAgreement(shortCode),
    enabled: Boolean(shortCode.trim()),
    retry: false,
  });

  const payload = agreementQuery.data;
  const amountLabel = useMemo(() => {
    if (!payload) return "";
    return formatSubscriptionAmountLabel(
      payload.amount,
      payload.currency,
      payload.billing_interval,
    );
  }, [payload]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!shortCode.trim()) throw new Error("Missing link");
      return signPublicSubscriptionAgreement({
        short_code: shortCode,
        signatory_name: signatoryName.trim(),
        signature_png: signaturePng,
        base_url: resolvePublicAppBaseUrl(),
      });
    },
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
      }
    },
  });

  if (agreementQuery.isPending) {
    return (
      <div className={shellClassName}>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading agreement…
        </p>
      </div>
    );
  }

  if (agreementQuery.isError || !payload) {
    return (
      <div className={shellClassName}>
        <p className="text-center text-sm text-muted-foreground">
          {(agreementQuery.error as Error)?.message ||
            "This agreement link is invalid or expired."}
        </p>
      </div>
    );
  }

  if (payload.already_active) {
    return (
      <div className={shellClassName}>
        <div className="rounded-lg border bg-white p-5 text-center">
          <Check className="mx-auto mb-2 size-6 text-emerald-600" />
          <p className="font-medium">Subscription active</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {payload.subscription_name} is already set up. Thank you.
          </p>
        </div>
      </div>
    );
  }

  if (cardStatus === "success" || (payload.already_signed && payload.card_on_file)) {
    return (
      <div className={shellClassName}>
        <div className="rounded-lg border bg-white p-5 text-center">
          <Check className="mx-auto mb-2 size-6 text-emerald-600" />
          <p className="font-medium">You&apos;re all set</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Signature and card received. Billing will start automatically.
          </p>
        </div>
      </div>
    );
  }

  const lines = Array.isArray(payload.line_items) ? payload.line_items : [];
  const canSubmit =
    agreed &&
    Boolean(signatoryName.trim()) &&
    signaturePng.startsWith("data:image/") &&
    !signMutation.isPending;

  return (
    <div className={shellClassName}>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Subscription agreement
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {payload.subscription_name}
        </h1>
        {payload.subscription_number ? (
          <p className="text-sm text-muted-foreground">
            {payload.subscription_number}
          </p>
        ) : null}
        <p className="text-base font-medium">{amountLabel}</p>
      </div>

      {lines.length > 0 ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plan
          </p>
          <ul className="space-y-2 text-sm">
            {lines.map((line, index) => {
              const description = String(
                line.description ?? line.name ?? `Item ${index + 1}`,
              );
              const qty = Number(line.quantity ?? 1) || 1;
              return (
                <li
                  key={`${description}-${index}`}
                  className="flex items-start justify-between gap-3"
                >
                  <span>
                    {description}
                    {qty !== 1 ? (
                      <span className="text-muted-foreground"> × {qty}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: payload.currency || "USD",
                    }).format(lineTotal(line))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4">
        <p className="mb-2 text-sm font-medium">Terms and conditions</p>
        {!payload.terms_markdown?.trim() ? (
          <p className="text-sm text-destructive">
            Terms are missing. Contact the sender.
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm">
            <Markdown>{payload.terms_markdown}</Markdown>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Scroll through the terms, then agree and sign below.
        </p>
      </div>

      {payload.already_signed ? (
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">
            Signed by {payload.signatory_name}. Continue to add your card.
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={signMutation.isPending}
            onClick={() => signMutation.mutate()}
          >
            {signMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Opening checkout…
              </>
            ) : (
              "Continue to card setup"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex items-start gap-2">
            <Checkbox
              id="agree-terms"
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
            />
            <Label htmlFor="agree-terms" className="text-sm leading-snug">
              I have read and agree to the terms. My signature starts this
              subscription after I add a payment card.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signatory">Initials / full name</Label>
            <Input
              id="signatory"
              value={signatoryName}
              onChange={(event) => setSignatoryName(event.target.value)}
              placeholder="e.g. J.D. or Jane Doe"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label>Signature</Label>
            <SignaturePad value={signaturePng} onChange={setSignaturePng} />
            <p className="text-xs text-muted-foreground">
              Draw with your finger or mouse. Name, date, time, and IP are
              recorded with this signature.
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => signMutation.mutate()}
          >
            {signMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Sign and add card"
            )}
          </Button>

          {signMutation.isError ? (
            <p className="text-sm text-destructive">
              {(signMutation.error as Error).message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
