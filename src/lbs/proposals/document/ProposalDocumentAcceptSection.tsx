import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableBlock } from "@/lbs/proposals/document/EditableBlock";
import {
  getProposalDocumentCopy,
  proposalDateLocale,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";
import {
  acceptPublicProposal,
  signPublicProposalContract,
} from "@/lbs/proposals/public/publicProposalApi";
import { formatProposalMoney } from "@/lbs/proposals/document/useProposalDocumentData";

const formatDisplayDate = (value: string | null | undefined, locale: ProposalLocale) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(proposalDateLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProposalDocumentAcceptSection = ({
  locale,
  mode,
  proposalId,
  depositAmount,
  currency,
  acceptedAt,
  contract,
  publicToken,
  onRefresh,
  editable = false,
  acceptTitle,
  acceptBody,
  onAcceptTitleChange,
  onAcceptBodyChange,
}: {
  locale: ProposalLocale;
  mode: "preview" | "live";
  proposalId: number;
  depositAmount: number;
  currency: string;
  acceptedAt?: string | null;
  contract?: {
    signed_at: string | null;
    deposit_paid_at?: string | null;
    terms_snapshot: string | null;
  } | null;
  publicToken?: string;
  onRefresh?: () => void;
  editable?: boolean;
  acceptTitle?: string;
  acceptBody?: string;
  onAcceptTitleChange?: (value: string) => void;
  onAcceptBodyChange?: (value: string) => void;
}) => {
  const copy = getProposalDocumentCopy(locale);
  const [signatoryName, setSignatoryName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [confirmDeposit, setConfirmDeposit] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAccepted = Boolean(acceptedAt);
  const isSigned = Boolean(contract?.signed_at);
  const depositPaid = Boolean(contract?.deposit_paid_at);
  const depositFormatted = formatProposalMoney(depositAmount, currency);

  const acceptMutation = useMutation({
    mutationFn: () => {
      if (!publicToken) throw new Error("Missing token");
      return acceptPublicProposal(proposalId, publicToken);
    },
    onSuccess: () => {
      setActionError(null);
      onRefresh?.();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const signMutation = useMutation({
    mutationFn: () => {
      if (!publicToken) throw new Error("Missing token");
      return signPublicProposalContract({
        proposalId,
        token: publicToken,
        signatoryName: signatoryName.trim(),
        confirmDeposit,
      });
    },
    onSuccess: () => {
      setActionError(null);
      onRefresh?.();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const showAcceptCard = mode === "preview" || !isAccepted;
  const showSignCard =
    mode === "preview" ? !isSigned : isAccepted && contract?.terms_snapshot && !isSigned;
  const previewAcceptDisabled = mode === "preview";
  const previewSignDisabled = mode === "preview" || !isAccepted;

  return (
    <div className="space-y-4">
      {editable ? (
        <>
          <EditableBlock
            as="h2"
            editable
            value={acceptTitle ?? copy.acceptDefaultTitle}
            onChange={(value) => onAcceptTitleChange?.(value)}
            placeholder={copy.acceptDefaultTitle}
          />
          <EditableBlock
            editable
            value={acceptBody ?? copy.acceptIntro}
            onChange={(value) => onAcceptBodyChange?.(value)}
            placeholder={copy.acceptIntro}
          />
        </>
      ) : (
        <h2 className="text-2xl font-semibold tracking-tight">
          {acceptTitle ?? copy.acceptDefaultTitle}
        </h2>
      )}

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {showAcceptCard ? (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{copy.acceptProposal}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {acceptBody ?? copy.acceptIntro}
            </p>
            <Button
              type="button"
              className="w-full"
              disabled={
                previewAcceptDisabled ||
                acceptMutation.isPending ||
                (mode === "live" && !publicToken)
              }
              onClick={() => acceptMutation.mutate()}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {acceptMutation.isPending ? copy.acceptPending : copy.acceptProposal}
            </Button>
            {previewAcceptDisabled ? (
              <p className="text-center text-xs text-muted-foreground">
                {copy.previewAcceptDisabled}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showSignCard ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{copy.signContract}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract?.terms_snapshot ? (
              <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/20 p-4 text-xs whitespace-pre-wrap">
                {contract.terms_snapshot}
              </div>
            ) : mode === "preview" ? (
              <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                {copy.previewSignDisabled}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="proposal-signatory-name">{copy.signatoryName}</Label>
              <Input
                id="proposal-signatory-name"
                value={signatoryName}
                disabled={previewSignDisabled}
                onChange={(event) => setSignatoryName(event.target.value)}
                placeholder={copy.signatoryPlaceholder}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                disabled={previewSignDisabled}
                checked={agreedTerms}
                onCheckedChange={(checked) => setAgreedTerms(checked === true)}
              />
              <span>{copy.agreeTerms}</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                disabled={previewSignDisabled}
                checked={confirmDeposit}
                onCheckedChange={(checked) => setConfirmDeposit(checked === true)}
              />
              <span>{copy.confirmDeposit(depositFormatted)}</span>
            </label>
            <Button
              type="button"
              className="w-full"
              disabled={
                previewSignDisabled ||
                signMutation.isPending ||
                !signatoryName.trim() ||
                !agreedTerms ||
                (mode === "live" && !publicToken)
              }
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {copy.signContractButton}
            </Button>
            {previewSignDisabled && mode === "preview" ? (
              <p className="text-center text-xs text-muted-foreground">
                {copy.previewSignDisabled}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isSigned && contract?.signed_at ? (
        <Card>
          <CardContent className="space-y-2 py-6 text-center text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              {copy.signedOn(formatDisplayDate(contract.signed_at, locale))}
            </p>
            {depositPaid ? (
              <p className="text-muted-foreground">{copy.depositRecorded}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
