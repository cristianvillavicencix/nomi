import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Button } from "@/components/ui/button";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import { applyLiveClientSignatureFields } from "@/modules/billing/subscriptions/applyLiveClientSignatureFields";
import { formatSubscriptionAmountLabel } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { cn } from "@/lib/utils";

export type SubscriptionAgreementClientViewModel = {
  subscription_name: string;
  subscription_number?: string | null;
  subscription_description?: string | null;
  amount: number;
  currency?: string;
  billing_interval: "weekly" | "monthly" | "yearly";
  line_items?: Array<Record<string, unknown>>;
  terms_markdown?: string | null;
  contract_title?: string | null;
  terms_version?: string | null;
  organization_name?: string | null;
  organization_logo_url?: string | null;
  provider_representative?: string | null;
  client_name?: string | null;
  client_representative?: string | null;
  client_address?: string | null;
};

/** Shared client-facing agreement layout (live portal + staff preview). */
export const SubscriptionAgreementClientView = ({
  model,
  preview = false,
  className,
  footer,
  liveSignatoryName,
  liveSignaturePng,
}: {
  model: SubscriptionAgreementClientViewModel;
  /** When true, signature controls are decorative and disabled. */
  preview?: boolean;
  className?: string;
  /** Live portal signature / continue UI. Defaults to disabled preview controls. */
  footer?: ReactNode;
  /** Live name typed in the signatory field (updates contract body). */
  liveSignatoryName?: string;
  /** Live drawn signature PNG (updates contract body). */
  liveSignaturePng?: string;
}) => {
  // Start closed so the first screen feels like a welcome, not a legal wall.
  const [agreementOpen, setAgreementOpen] = useState(false);
  const amountLabel = formatSubscriptionAmountLabel(
    model.amount,
    model.currency ?? "USD",
    model.billing_interval,
  );
  const provider = model.organization_name?.trim() || "Provider";
  const clientCompany = model.client_name?.trim() || null;
  const clientRepresentative = model.client_representative?.trim() || null;
  const logoUrl = model.organization_logo_url?.trim() || "/logos/sigma.png";
  const greetingName =
    liveSignatoryName?.trim() ||
    (clientRepresentative &&
    clientRepresentative !== "—" &&
    clientRepresentative !== "-"
      ? clientRepresentative
      : "") ||
    null;
  const planName = model.subscription_name?.trim() || "your subscription";

  const liveTerms = useMemo(() => {
    const base = model.terms_markdown?.trim() || "";
    if (!base) return "";
    return applyLiveClientSignatureFields(base, {
      signatoryName: greetingName || "",
      signaturePng: liveSignaturePng,
    });
  }, [model.terms_markdown, greetingName, liveSignaturePng]);

  return (
    <div className={cn("flex w-full flex-col gap-8", className)}>
      {preview ? (
        <p className="text-center text-xs text-muted-foreground">
          Preview only — signing is disabled here. After you send the link, use
          View as client on the subscription to open the live portal.
        </p>
      ) : null}

      {/* Friendly first screen — not a wall of legalese */}
      <header className="space-y-6">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt={provider}
            className="h-10 w-auto max-w-[148px] object-contain"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-neutral-500">{provider}</p>
          <h1 className="max-w-xl text-[1.75rem] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[2rem]">
            {greetingName ? (
              <>
                Hi {greetingName},
                <span className="mt-1 block text-[1.35rem] font-normal text-neutral-700 sm:text-[1.5rem]">
                  ready to get started?
                </span>
              </>
            ) : (
              "You're almost set"
            )}
          </h1>
          <p className="max-w-lg text-[0.95rem] leading-relaxed text-neutral-600">
            {provider} invited you to review a short agreement for{" "}
            <span className="font-medium text-neutral-800">{planName}</span>
            {amountLabel ? (
              <>
                {" "}
                ({amountLabel})
              </>
            ) : null}
            {clientCompany ? (
              <>
                {" "}
                for <span className="font-medium text-neutral-800">{clientCompany}</span>
              </>
            ) : null}
            . Sign below, then add a card — billing starts after that.
          </p>
        </div>

        <ol className="flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          <li className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
              1
            </span>
            Review terms
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
              2
            </span>
            Sign
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
              3
            </span>
            Add your card
          </li>
        </ol>

        {model.subscription_number?.trim() ? (
          <p className="text-xs text-neutral-400">
            Reference {model.subscription_number.trim()}
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        {!liveTerms ? (
          <p className="text-sm text-destructive">
            {preview
              ? "Add terms above to preview them here."
              : "Terms are missing. Contact the sender."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
              onClick={() => setAgreementOpen((open) => !open)}
              aria-expanded={agreementOpen}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-neutral-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-neutral-900">
                    {agreementOpen ? "Hide agreement" : "Review the agreement"}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {model.contract_title?.trim() || "Subscription terms"}
                    {model.terms_version
                      ? ` · v${model.terms_version}`
                      : ""}
                  </span>
                </span>
              </span>
              {agreementOpen ? (
                <ChevronUp className="size-4 shrink-0 text-neutral-500" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-neutral-500" />
              )}
            </button>

            {agreementOpen ? (
              <div className="border-t border-neutral-200 px-4 pb-4 pt-2">
                <div className="contract-preview-shell relative max-h-[min(70vh,36rem)] overflow-y-auto">
                  <ContractDocumentMarkdown page portal>
                    {liveTerms}
                  </ContractDocumentMarkdown>
                </div>
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-neutral-600"
                    onClick={() => setAgreementOpen(false)}
                  >
                    <ChevronUp className="size-4" />
                    Done reviewing
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-neutral-100 px-4 py-5">
                <p className="text-center text-xs leading-relaxed text-neutral-400">
                  Open when you want to read the full terms — then come back
                  here to sign.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {footer !== undefined ? (
        footer
      ) : (
        <div
          className={cn(
            "space-y-5 border-t border-neutral-200/80 pt-8",
            preview && "pointer-events-none opacity-80",
          )}
        >
          <div className="flex items-start gap-2">
            <Checkbox id="agree-terms-preview" checked={false} disabled />
            <Label
              htmlFor="agree-terms-preview"
              className="text-sm leading-snug text-neutral-700"
            >
              I have read and agree to the terms. My signature starts this
              subscription after I add a payment card.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signatory-preview">Initials / full name</Label>
            <Input
              id="signatory-preview"
              placeholder="e.g. J.D. or Jane Doe"
              disabled
              value=""
            />
          </div>

          <div className="space-y-2">
            <Label>Signature</Label>
            <SignaturePad value="" onChange={() => undefined} disabled />
          </div>
        </div>
      )}
    </div>
  );
};
