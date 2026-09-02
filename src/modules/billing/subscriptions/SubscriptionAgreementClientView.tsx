import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/ui/signature-pad";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
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
}: {
  model: SubscriptionAgreementClientViewModel;
  /** When true, signature controls are decorative and disabled. */
  preview?: boolean;
  className?: string;
  /** Live portal signature / continue UI. Defaults to disabled preview controls. */
  footer?: ReactNode;
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

  return (
    <div className={cn("flex w-full flex-col gap-5", className)}>
      {preview ? (
        <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-center text-xs text-muted-foreground">
          Preview only — signing is disabled here. After you send the link, use
          View as client on the subscription to open the live portal.
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {model.contract_title?.trim() || "Subscription agreement"}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {model.subscription_name || "Subscription"}
        </h1>
        {model.subscription_description?.trim() ? (
          <p className="text-sm text-muted-foreground">
            {model.subscription_description.trim()}
          </p>
        ) : null}
        {model.subscription_number ? (
          <p className="text-sm text-muted-foreground">
            {model.subscription_number}
          </p>
        ) : null}
        {model.terms_version ? (
          <p className="text-xs text-muted-foreground">
            Document version {model.terms_version}
          </p>
        ) : null}
        <p className="text-base font-medium">{amountLabel}</p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Provider
          </p>
          <p className="text-sm font-medium">{provider}</p>
          {model.provider_representative?.trim() ? (
            <p className="text-xs text-muted-foreground">
              Representative: {model.provider_representative.trim()}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Client company
          </p>
          <p className="text-sm font-medium">{clientCompany}</p>
          {clientRepresentative ? (
            <p className="text-xs text-muted-foreground">
              Representative: {clientRepresentative}
            </p>
          ) : null}
          {model.client_address?.trim() ? (
            <p className="text-xs text-muted-foreground">
              {model.client_address}
            </p>
          ) : null}
        </div>
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
                      currency,
                    }).format(lineTotal(line))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-neutral-100 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Agreement
          </p>
        </div>
        {!model.terms_markdown?.trim() ? (
          <p className="p-4 text-sm text-destructive">
            {preview
              ? "Add terms above to preview them here."
              : "Terms are missing. Contact the sender."}
          </p>
        ) : (
          <div className="max-h-[min(36rem,62vh)] overflow-y-auto bg-[#e5e7eb]">
            <ContractDocumentMarkdown page>
              {model.terms_markdown}
            </ContractDocumentMarkdown>
          </div>
        )}
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Scroll through the agreement, then sign below.
        </p>
      </div>

      {footer !== undefined ? (
        footer
      ) : (
        <div
          className={cn(
            "space-y-4 rounded-lg border bg-white p-4",
            preview && "pointer-events-none opacity-80",
          )}
        >
          <div className="flex items-start gap-2">
            <Checkbox id="agree-terms-preview" checked={false} disabled />
            <Label
              htmlFor="agree-terms-preview"
              className="text-sm leading-snug"
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
            <p className="text-xs text-muted-foreground">
              Draw with your finger or mouse. Name, date, time, and IP are
              recorded with this signature.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
