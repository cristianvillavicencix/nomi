import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Lock, Pencil, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import type { ProposalLocale } from "@/lbs/proposals/document/proposalDocumentI18n";
import { formatProposalMoney } from "@/lbs/proposals/document/useProposalDocumentData";
import { getProposalAcceptPortalCopy } from "@/lbs/proposals/public/proposalAcceptPortalI18n";
import {
  acceptPublicProposal,
  payPublicProposalDeposit,
  signPublicProposalContract,
  type PublicProposalPayload,
} from "@/lbs/proposals/public/publicProposalApi";

type PortalTab = "sign" | "deposit";

const lineItemTotal = (line: {
  quantity?: number;
  unit_price?: number;
}) => (line.quantity ?? 1) * (line.unit_price ?? 0);

export const PublicProposalAcceptPortal = ({
  token,
  payload,
  locale,
  mode,
  onRefresh,
}: {
  token: string;
  payload: PublicProposalPayload;
  locale: ProposalLocale;
  mode: "live" | "preview";
  onRefresh: () => void;
}) => {
  const copy = getProposalAcceptPortalCopy(locale);
  const isPreview = mode === "preview";
  const stripeMock = isClientBillingSkipped();

  const { proposal, line_items, installments, contract } = payload;
  const currency = proposal.currency ?? "USD";
  const termsMarkdown =
    contract?.terms_snapshot?.trim() ||
    payload.terms_markdown?.trim() ||
    "";

  const oneTimeLines = line_items.filter((l) => l.billing_type !== "recurring");
  const recurringLines = line_items.filter((l) => l.billing_type === "recurring");
  const oneTimeTotal =
    oneTimeLines.reduce((sum, line) => sum + lineItemTotal(line), 0) ||
    proposal.amount ||
    0;
  const recurringTotal = recurringLines.reduce(
    (sum, line) => sum + lineItemTotal(line),
    0,
  );

  const depositInstallment = installments.find((row) =>
    row.label.toLowerCase().includes("deposit"),
  );
  const balanceInstallments = installments.filter(
    (row) => !row.label.toLowerCase().includes("deposit"),
  );
  const depositAmount = depositInstallment?.amount ?? proposal.deposit_amount ?? 0;
  const depositFormatted = formatProposalMoney(depositAmount, currency);
  const balancePerPayment = balanceInstallments[0]?.amount ?? 0;

  const isSigned = Boolean(contract?.signed_at);
  const depositPaid = Boolean(contract?.deposit_paid_at);
  const [tab, setTab] = useState<PortalTab>(
    depositPaid ? "deposit" : isSigned ? "deposit" : "sign",
  );
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const proposalLabel = proposal.proposal_number
    ? `#${proposal.proposal_number}`
    : `#${proposal.id}`;

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!proposal.accepted_at) {
        await acceptPublicProposal(proposal.id, token);
      }
      return signPublicProposalContract({
        proposalId: proposal.id,
        token,
        signatoryName: signatoryName.trim(),
      });
    },
    onSuccess: () => {
      setActionError(null);
      setTab("deposit");
      onRefresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      payPublicProposalDeposit({ proposalId: proposal.id, token }),
    onSuccess: () => {
      setActionError(null);
      onRefresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const canSign =
    !isPreview &&
    signatoryName.trim().length > 0 &&
    agreedTerms &&
    Boolean(termsMarkdown) &&
    !isSigned;

  const canPay = !isPreview && isSigned && !depositPaid;

  const totalLine = useMemo(() => {
    if (recurringTotal > 0) {
      return `${formatProposalMoney(oneTimeTotal, currency)} + ${formatProposalMoney(recurringTotal, currency)}/mo`;
    }
    return formatProposalMoney(oneTimeTotal, currency);
  }, [currency, oneTimeTotal, recurringTotal]);

  if (depositPaid) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <Check className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.completeTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.completeBody}</p>
        <Button variant="outline" asChild>
          <Link to={`/proposal/${token}`}>{copy.backToProposal}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          L
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Proposal {proposalLabel} — {proposal.title}
        </p>
      </div>

      <div className="flex justify-center gap-2">
        <StepPill
          active={tab === "sign"}
          done={isSigned}
          number={1}
          label={copy.stepSign}
          onClick={() => setTab("sign")}
        />
        <StepPill
          active={tab === "deposit"}
          done={depositPaid}
          disabled={!isSigned}
          number={2}
          label={copy.stepDeposit}
          onClick={() => isSigned && setTab("deposit")}
        />
      </div>

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <Card className="border-primary/20 shadow-md">
        <CardHeader className="space-y-3 border-b bg-muted/20 pb-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{copy.oneTimePayment}</span>
              <span className="font-medium tabular-nums">
                {formatProposalMoney(oneTimeTotal, currency)}
              </span>
            </div>
            {recurringTotal > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{copy.recurring}</span>
                <span className="font-medium text-primary tabular-nums">
                  {formatProposalMoney(recurringTotal, currency)}/mo
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{copy.totalProject}</span>
              <span className="tabular-nums">{totalLine}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {tab === "sign" ? (
            <>
              {!termsMarkdown ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {copy.termsRequired}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">{copy.termsHeading}</p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Markdown>{termsMarkdown}</Markdown>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {copy.termsScrollHint}
                  </p>
                </>
              )}

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  disabled={isPreview || !termsMarkdown || isSigned}
                  checked={agreedTerms}
                  onCheckedChange={(checked) =>
                    setAgreedTerms(checked === true)
                  }
                />
                <span>{copy.agreeTerms}</span>
              </label>

              <div className="space-y-2">
                <Label htmlFor="portal-signatory">{copy.signatureLabel}</Label>
                <Input
                  id="portal-signatory"
                  disabled={isPreview || isSigned}
                  value={signatoryName}
                  onChange={(event) => setSignatoryName(event.target.value)}
                  placeholder={copy.signaturePlaceholder}
                  className="text-base"
                />
              </div>

              <Button
                type="button"
                className="w-full"
                size="lg"
                disabled={!canSign || signMutation.isPending}
                onClick={() => signMutation.mutate()}
              >
                {signMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                {signMutation.isPending ? copy.signing : copy.signAndContinue}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {copy.signatureFootnote}
              </p>

              {isPreview ? (
                <p className="text-center text-xs text-muted-foreground">
                  {copy.previewDisabled}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {isSigned ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                  <Check className="size-4 shrink-0" />
                  {copy.signedBanner}
                </div>
              ) : null}

              <CardTitle className="text-base">{copy.payDepositTitle}</CardTitle>

              <div className="rounded-xl bg-primary px-4 py-5 text-primary-foreground">
                <p className="text-sm opacity-90">
                  {copy.depositInitial(proposal.deposit_percent ?? 50)}
                </p>
                <p className="text-3xl font-bold tabular-nums">{depositFormatted}</p>
                {balanceInstallments.length > 0 ? (
                  <p className="mt-2 text-xs opacity-90">
                    {copy.balanceNote(
                      balanceInstallments.length,
                      formatProposalMoney(balancePerPayment, currency),
                    )}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.paymentDetails}
                </p>
                <Input
                  disabled
                  placeholder={copy.cardNumber}
                  className="bg-muted/30"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    disabled
                    placeholder={copy.cardExpiry}
                    className="bg-muted/30"
                  />
                  <Input
                    disabled
                    placeholder={copy.cardCvc}
                    className="bg-muted/30"
                  />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  {copy.stripeSecure}
                </p>
              </div>

              {stripeMock ? (
                <p className="text-xs text-muted-foreground">{copy.mockModeNote}</p>
              ) : null}

              <Button
                type="button"
                className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
                size="lg"
                disabled={!canPay || payMutation.isPending}
                onClick={() => payMutation.mutate()}
              >
                {payMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wallet className="size-4" />
                )}
                {payMutation.isPending
                  ? copy.paying
                  : copy.payDeposit(depositFormatted)}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {copy.depositFootnote}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Link
          to={`/proposal/${token}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← {copy.backToProposal}
        </Link>
      </div>
    </div>
  );
};

const StepPill = ({
  active,
  done,
  disabled,
  number,
  label,
  onClick,
}: {
  active: boolean;
  done?: boolean;
  disabled?: boolean;
  number: number;
  label: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
      active && "border-primary bg-primary/10 text-primary",
      !active && !done && "text-muted-foreground",
      done && !active && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
      disabled && "cursor-not-allowed opacity-50",
    )}
  >
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
        active && "bg-primary text-primary-foreground",
        done && !active && "bg-emerald-500 text-white",
        !active && !done && "bg-muted",
      )}
    >
      {done && !active ? <Check className="size-3.5" /> : number}
    </span>
    {label}
  </button>
);
