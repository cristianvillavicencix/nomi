import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableBlock } from "@/modules/proposals/document/EditableBlock";
import {
  getProposalDocumentCopy,
  proposalDateLocale,
  type ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";
import { formatProposalMoney } from "@/modules/proposals/document/useProposalDocumentData";

const formatDisplayDate = (
  value: string | null | undefined,
  locale: ProposalLocale,
) => {
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
  depositAmount,
  currency,
  contract,
  publicToken,
  editable = false,
  acceptTitle,
  acceptBody,
  onAcceptTitleChange,
  onAcceptBodyChange,
  termsMarkdown,
  termsTitle,
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
  termsMarkdown?: string;
  termsTitle?: string | null;
  publicToken?: string;
  onRefresh?: () => void;
  editable?: boolean;
  acceptTitle?: string;
  acceptBody?: string;
  onAcceptTitleChange?: (value: string) => void;
  onAcceptBodyChange?: (value: string) => void;
}) => {
  const copy = getProposalDocumentCopy(locale);
  const isSigned = Boolean(contract?.signed_at);
  const depositPaid = Boolean(contract?.deposit_paid_at);
  const depositFormatted = formatProposalMoney(depositAmount, currency);
  const acceptPath = publicToken ? `/proposal/${publicToken}/accept` : null;
  const termsForPdf = termsMarkdown?.trim();

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

      {!editable ? (
        <p className="text-sm text-muted-foreground">
          {acceptBody ?? copy.acceptIntro}
        </p>
      ) : null}

      <div data-pdf-only className="hidden">
        <p className="pf-pdf-accept-note">{copy.pdfAcceptNote}</p>
        {depositAmount > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.confirmDeposit(depositFormatted)}
          </p>
        ) : null}
        {termsForPdf ? (
          <div className="pf-pdf-terms">
            {termsTitle ? (
              <p className="mb-2 text-sm font-semibold text-foreground">
                {termsTitle}
              </p>
            ) : null}
            {termsForPdf}
          </div>
        ) : null}
      </div>

      {depositPaid && contract?.signed_at ? (
        <Card data-pdf-hide>
          <CardContent className="space-y-2 py-6 text-center text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              {copy.signedOn(formatDisplayDate(contract.signed_at, locale))}
            </p>
            <p className="text-muted-foreground">{copy.depositRecorded}</p>
          </CardContent>
        </Card>
      ) : isSigned && acceptPath ? (
        <Card className="border-amber-500/30 bg-amber-500/5" data-pdf-hide>
          <CardContent className="space-y-4 py-4">
            <p className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-amber-600" />
              Contract signed — deposit pending ({depositFormatted})
            </p>
            <Button asChild className="w-full">
              <Link to={acceptPath}>
                Pay deposit
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : acceptPath && mode === "live" ? (
        <Card data-pdf-hide>
          <CardContent className="space-y-4 py-6">
            <Button asChild className="w-full" size="lg">
              <Link to={acceptPath}>
                Continue to sign & pay
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : mode === "preview" ? (
        <p className="text-xs text-muted-foreground" data-pdf-hide>
          {copy.previewAcceptDisabled}
        </p>
      ) : null}
    </div>
  );
};
