import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Download, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { resolvePublicAppBaseUrl } from "@/lib/publicAppUrl";
import {
  downloadPublicAgreementPdf,
  fetchPublicSubscriptionAgreement,
  fetchPublicSubscriptionAgreementDocuments,
  signPublicSubscriptionAgreement,
} from "@/modules/billing/public/publicSubscriptionAgreementApi";
import { SubscriptionAgreementClientView } from "@/modules/billing/subscriptions/SubscriptionAgreementClientView";

const shellClassName =
  "mx-auto flex min-h-[100dvh] w-full max-w-[36rem] flex-col gap-8 bg-white px-5 py-10 sm:max-w-[40rem] sm:px-8 sm:py-14";

const AgreementCompletePanel = ({
  shortCode,
  subscriptionName,
}: {
  shortCode: string;
  subscriptionName?: string | null;
}) => {
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const documentsMutation = useMutation({
    mutationFn: async () => {
      if (!shortCode.trim()) throw new Error("Missing link");
      return fetchPublicSubscriptionAgreementDocuments(shortCode);
    },
    onSuccess: (docs) => {
      if (docs.email_sent && docs.client_email) {
        setEmailHint(`We also emailed copies to ${docs.client_email}.`);
      } else if (docs.client_email) {
        setEmailHint(`Copies were sent (or previously sent) to ${docs.client_email}.`);
      }
    },
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        try {
          await documentsMutation.mutateAsync();
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // Load once on success (retries briefly while Stripe webhook settles).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode]);

  const docs = documentsMutation.data;

  return (
    <div className="space-y-5 py-6 text-center">
      <Check className="mx-auto size-7 text-emerald-700" />
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight text-neutral-900">
          You&apos;re all set
        </p>
        <p className="text-sm text-neutral-600">
          Signature and card received
          {subscriptionName ? ` for ${subscriptionName}` : ""}. Billing will start
          automatically.
        </p>
      </div>

      <div className="mx-auto grid max-w-md gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!docs || documentsMutation.isPending}
          onClick={() => {
            if (!docs) return;
            downloadPublicAgreementPdf(
              docs.receipt_pdf_base64,
              docs.receipt_filename,
            );
          }}
        >
          <Download className="size-4" />
          Download receipt
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!docs || documentsMutation.isPending}
          onClick={() => {
            if (!docs) return;
            downloadPublicAgreementPdf(
              docs.contract_pdf_base64,
              docs.contract_filename,
            );
          }}
        >
          <Download className="size-4" />
          Download contract
        </Button>
      </div>

      {documentsMutation.isPending ? (
        <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" />
          Preparing your PDFs…
        </p>
      ) : null}

      {emailHint ? (
        <p className="flex items-start justify-center gap-1.5 text-xs text-neutral-500">
          <Mail className="mt-0.5 size-3.5 shrink-0" />
          <span>{emailHint}</span>
        </p>
      ) : null}

      {documentsMutation.isError ? (
        <p className="text-sm text-destructive">
          {(documentsMutation.error as Error).message}
        </p>
      ) : null}
    </div>
  );
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

  useEffect(() => {
    const prefill = payload?.client_representative?.trim();
    if (!prefill || prefill === "—" || prefill === "-") return;
    setSignatoryName((current) => (current.trim() ? current : prefill));
  }, [payload?.client_representative]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!shortCode.trim()) throw new Error("Missing link");
      return signPublicSubscriptionAgreement({
        short_code: shortCode,
        signatory_name: signatoryName.trim() ||
          (payload?.client_representative?.trim() &&
          payload.client_representative.trim() !== "—"
            ? payload.client_representative.trim()
            : ""),
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
        <AgreementCompletePanel
          shortCode={shortCode}
          subscriptionName={payload.subscription_name}
        />
      </div>
    );
  }

  if (
    cardStatus === "success" ||
    (payload.already_signed && payload.card_on_file)
  ) {
    return (
      <div className={shellClassName}>
        <AgreementCompletePanel
          shortCode={shortCode}
          subscriptionName={payload.subscription_name}
        />
      </div>
    );
  }

  const prefilledRep = (() => {
    const fromPayload = payload.client_representative?.trim() || "";
    if (fromPayload && fromPayload !== "—" && fromPayload !== "-") {
      return fromPayload;
    }
    return "";
  })();

  const resolvedClientRep = signatoryName.trim() || prefilledRep;

  const canSubmit =
    agreed &&
    Boolean(resolvedClientRep) &&
    signaturePng.startsWith("data:image/") &&
    !signMutation.isPending;

  const model = {
    subscription_name: payload.subscription_name,
    subscription_number: payload.subscription_number,
    subscription_description: payload.subscription_description,
    amount: payload.amount,
    currency: payload.currency,
    billing_interval: payload.billing_interval,
    line_items: payload.line_items,
    terms_markdown: payload.terms_markdown,
    contract_title: payload.contract_title,
    terms_version: payload.terms_version,
    organization_name: payload.organization_name,
    organization_logo_url: payload.organization_logo_url,
    provider_representative: payload.provider_representative,
    client_name: payload.client_name,
    client_representative: resolvedClientRep || payload.client_representative,
    client_address: payload.client_address,
  };

  return (
    <div className={shellClassName}>
      <SubscriptionAgreementClientView
        model={model}
        liveSignatoryName={resolvedClientRep}
        liveSignaturePng={signaturePng}
        footer={
          payload.already_signed ? (
            <div className="space-y-4 border-t border-neutral-200/80 pt-8">
              <p className="text-sm text-neutral-600">
                Signed by {payload.signatory_name}. Continue to add your card.
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto sm:min-w-[14rem]"
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
              {signMutation.isError ? (
                <p className="text-sm text-destructive">
                  {(signMutation.error as Error).message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 space-y-6 rounded-lg border border-neutral-300 bg-white p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Sign to continue
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  Your name is already filled from the client record. Draw your
                  signature below to finish.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="agree-terms"
                  checked={agreed}
                  onCheckedChange={(value) => setAgreed(value === true)}
                />
                <Label
                  htmlFor="agree-terms"
                  className="text-sm leading-snug text-neutral-700"
                >
                  I have read and agree to the terms. My signature starts this
                  subscription after I add a payment card.
                </Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signatory" className="text-neutral-700">
                  Full name / initials
                </Label>
                <Input
                  id="signatory"
                  value={signatoryName || prefilledRep}
                  onChange={(event) => setSignatoryName(event.target.value)}
                  placeholder="Loaded from client contact"
                  autoComplete="name"
                  className="max-w-md border-neutral-300 bg-white"
                />
                {prefilledRep ? (
                  <p className="text-xs text-neutral-500">
                    Prefilled from the contact on this agreement. Edit only if
                    needed.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold text-neutral-900">
                  Your signature
                </Label>
                <p className="text-sm text-neutral-600">
                  Draw here — that&apos;s the main step.
                </p>
                <SignaturePad
                  value={signaturePng}
                  onChange={setSignaturePng}
                  height={160}
                  className="w-full max-w-xl"
                  canvasClassName="min-h-[160px] rounded-md border-2 border-neutral-400 bg-neutral-50 shadow-none ring-0"
                />
                {!signaturePng ? (
                  <p className="text-xs font-medium text-amber-700">
                    Signature required to continue.
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Name, date, time, and IP are recorded with this signature.
                  </p>
                )}
              </div>

              <Button
                type="button"
                className="w-full sm:w-auto sm:min-w-[14rem]"
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
          )
        }
      />
    </div>
  );
};
