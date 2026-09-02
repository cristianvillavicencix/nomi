import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const amountLabel = formatSubscriptionAmountLabel(
    model.amount,
    model.currency ?? "USD",
    model.billing_interval,
  );
  const provider = model.organization_name?.trim() || "Provider";
  const clientRepresentative = model.client_representative?.trim() || null;
  const logoUrl = model.organization_logo_url?.trim() || "/logos/sigma.png";

  const liveTerms = useMemo(() => {
    const base = model.terms_markdown?.trim() || "";
    if (!base) return "";
    return applyLiveClientSignatureFields(base, {
      signatoryName:
        liveSignatoryName?.trim() ||
        (clientRepresentative &&
        clientRepresentative !== "—" &&
        clientRepresentative !== "-"
          ? clientRepresentative
          : ""),
      signaturePng: liveSignaturePng,
    });
  }, [
    model.terms_markdown,
    liveSignatoryName,
    liveSignaturePng,
    clientRepresentative,
  ]);

  const metaBits = [
    model.subscription_number?.trim() || null,
    amountLabel,
  ].filter(Boolean);

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      {preview ? (
        <p className="text-center text-xs text-muted-foreground">
          Preview only — signing is disabled here. After you send the link, use
          View as client on the subscription to open the live portal.
        </p>
      ) : null}

      {/* Brand only — parties, plan, and title live inside the contract body. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={logoUrl}
            alt={provider}
            className="h-9 w-auto max-w-[140px] object-contain sm:h-10"
          />
          <p className="truncate text-sm font-medium text-neutral-800">
            {provider}
          </p>
        </div>
        {metaBits.length > 0 ? (
          <p className="text-sm text-neutral-500">{metaBits.join(" · ")}</p>
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
          <>
            <div
              className={cn(
                "contract-preview-shell relative",
                !agreementExpanded && "contract-preview-shell--collapsed",
              )}
            >
              <div
                className={cn(
                  !agreementExpanded && "max-h-[22rem] overflow-hidden",
                )}
              >
                <ContractDocumentMarkdown page portal>
                  {liveTerms}
                </ContractDocumentMarkdown>
              </div>
              {!agreementExpanded ? (
                <div
                  className="contract-preview-fade pointer-events-none absolute inset-x-0 bottom-0 h-28"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => setAgreementExpanded((open) => !open)}
              >
                {agreementExpanded ? (
                  <>
                    <ChevronUp className="size-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    View full agreement
                  </>
                )}
              </Button>
            </div>
          </>
        )}
        <p className="text-sm text-neutral-500">
          Name and company details are already filled. Sign below to continue.
        </p>
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
            <p className="text-xs text-neutral-500">
              Draw with your finger or mouse. Name, date, time, and IP are
              recorded with this signature.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
