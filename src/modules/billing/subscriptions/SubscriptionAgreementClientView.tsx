import { useMemo, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import { applyLiveClientSignatureFields } from "@/modules/billing/subscriptions/subscriptionAgreementMerge";
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

const lineTotal = (row: Record<string, unknown>) => {
  const qty = Number(row.quantity ?? 1) || 1;
  const unit = Number(row.unit_price ?? 0) || 0;
  return qty * unit;
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
  const amountLabel = formatSubscriptionAmountLabel(
    model.amount,
    model.currency ?? "USD",
    model.billing_interval,
  );
  const lines = Array.isArray(model.line_items) ? model.line_items : [];
  const currency = model.currency || "USD";
  const provider = model.organization_name?.trim() || "Provider";
  const clientCompany = model.client_name?.trim() || "Client";
  const clientRepresentative = model.client_representative?.trim() || null;
  const logoUrl = model.organization_logo_url?.trim() || "/logos/sigma.png";

  const liveTerms = useMemo(() => {
    const base = model.terms_markdown?.trim() || "";
    if (!base) return "";
    return applyLiveClientSignatureFields(base, {
      signatoryName: liveSignatoryName ?? clientRepresentative,
      signaturePng: liveSignaturePng,
    });
  }, [
    model.terms_markdown,
    liveSignatoryName,
    liveSignaturePng,
    clientRepresentative,
  ]);

  return (
    <div className={cn("flex w-full flex-col gap-8", className)}>
      {preview ? (
        <p className="text-center text-xs text-muted-foreground">
          Preview only — signing is disabled here. After you send the link, use
          View as client on the subscription to open the live portal.
        </p>
      ) : null}

      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={logoUrl}
            alt={provider}
            className="h-10 w-auto max-w-[160px] object-contain sm:h-12"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-800">{provider}</p>
            {model.provider_representative?.trim() ? (
              <p className="text-xs text-neutral-500">
                {model.provider_representative.trim()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-b border-neutral-200 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            {model.contract_title?.trim() || "Subscription agreement"}
          </p>
          <h1 className="max-w-3xl text-[1.65rem] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[1.85rem]">
            {model.subscription_name || "Subscription"}
          </h1>
          {model.subscription_description?.trim() ? (
            <p className="max-w-2xl text-[0.95rem] leading-relaxed text-neutral-600">
              {model.subscription_description.trim()}
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1 text-sm text-neutral-500">
            {model.subscription_number ? (
              <span>{model.subscription_number}</span>
            ) : null}
            {model.terms_version ? (
              <span>Version {model.terms_version}</span>
            ) : null}
            <span className="text-base font-medium text-neutral-900">
              {amountLabel}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Provider
          </p>
          <p className="text-[0.95rem] font-medium text-neutral-900">
            {provider}
          </p>
          {model.provider_representative?.trim() ? (
            <p className="text-sm text-neutral-600">
              Representative: {model.provider_representative.trim()}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Client
          </p>
          <p className="text-[0.95rem] font-medium text-neutral-900">
            {clientCompany}
          </p>
          {(liveSignatoryName?.trim() || clientRepresentative) ? (
            <p className="text-sm text-neutral-600">
              Representative:{" "}
              {liveSignatoryName?.trim() || clientRepresentative}
            </p>
          ) : null}
          {model.client_address?.trim() ? (
            <p className="text-sm text-neutral-600">{model.client_address}</p>
          ) : null}
        </div>
      </section>

      {lines.length > 0 ? (
        <section className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Plan
          </p>
          <ul className="divide-y divide-neutral-200/80">
            {lines.map((line, index) => {
              const description = String(
                line.description ?? line.name ?? `Item ${index + 1}`,
              );
              const qty = Number(line.quantity ?? 1) || 1;
              return (
                <li
                  key={`${description}-${index}`}
                  className="flex items-start justify-between gap-4 py-3 text-[0.95rem] first:pt-0 last:pb-0"
                >
                  <span className="text-neutral-800">
                    {description}
                    {qty !== 1 ? (
                      <span className="text-neutral-500"> × {qty}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-neutral-900">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency,
                    }).format(lineTotal(line))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Agreement
        </p>
        {!liveTerms ? (
          <p className="text-sm text-destructive">
            {preview
              ? "Add terms above to preview them here."
              : "Terms are missing. Contact the sender."}
          </p>
        ) : (
          <ContractDocumentMarkdown page portal>
            {liveTerms}
          </ContractDocumentMarkdown>
        )}
        <p className="text-sm text-neutral-500">
          Review the agreement above, then sign below to continue.
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
