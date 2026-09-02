import { useState } from "react";
import { Download } from "lucide-react";
import { useNotify } from "ra-core";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import { downloadSubscriptionAgreementPdf } from "@/modules/billing/subscriptions/subscriptionAgreementClientPdf";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SignedSubscriptionAgreementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termsMarkdown?: string | null;
  signatoryName?: string | null;
  signedAt?: string | null;
  signaturePng?: string | null;
  clientCompany?: string | null;
  clientRepresentative?: string | null;
  providerRepresentative?: string | null;
  clientAddress?: string | null;
  subscriptionName?: string | null;
  subscriptionDescription?: string | null;
  subscriptionNumber?: string | null;
};

/** A4 content width ≈ 210mm; keep readable margins on the sheet. */
const A4_DIALOG_CLASS =
  "flex max-h-[92vh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,210mm)]";

export function SignedSubscriptionAgreementDialog({
  open,
  onOpenChange,
  termsMarkdown,
  signatoryName,
  signedAt,
  signaturePng,
  clientCompany,
  clientRepresentative,
  providerRepresentative,
  clientAddress,
  subscriptionName,
  subscriptionDescription,
  subscriptionNumber,
}: SignedSubscriptionAgreementDialogProps) {
  const notify = useNotify();
  const [downloading, setDownloading] = useState(false);
  const company = clientCompany?.trim() || null;
  const representative =
    clientRepresentative?.trim() || signatoryName?.trim() || null;
  const providerRep = providerRepresentative?.trim() || null;
  const canDownload = Boolean(termsMarkdown?.trim() || signaturePng);

  const handleDownload = async () => {
    if (!canDownload || downloading) return;
    setDownloading(true);
    try {
      await downloadSubscriptionAgreementPdf({
        title: subscriptionName?.trim() || "Subscription agreement",
        markdown: termsMarkdown ?? "",
        subscriptionNumber,
        clientName: company || representative,
        signatoryName,
        signedAt,
        signaturePngDataUrl: signaturePng,
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not download the signed agreement",
        { type: "error" },
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={A4_DIALOG_CLASS}>
        <DialogHeader className="shrink-0 border-b px-5 py-3 sm:px-8">
          <DialogTitle>Signed agreement</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-6 sm:py-5">
          <article className="mx-auto min-h-[min(70vh,297mm)] w-full max-w-[210mm] space-y-5 rounded-sm border bg-white px-5 py-6 shadow-sm sm:px-[14mm] sm:py-[12mm]">
            {(company || representative || subscriptionName) && (
              <header className="space-y-3 border-b pb-4">
                {subscriptionName ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                      Subscription
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {subscriptionName}
                    </p>
                    {subscriptionDescription?.trim() ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {subscriptionDescription.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Provider
                    </p>
                    <p className="text-sm font-medium">
                      Latinos Business Support LLC
                    </p>
                    {providerRep ? (
                      <p className="text-xs text-muted-foreground">
                        Representative: {providerRep}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Client company
                    </p>
                    <p className="text-sm font-medium">
                      {company || "—"}
                    </p>
                    {representative ? (
                      <p className="text-xs text-muted-foreground">
                        Representative: {representative}
                      </p>
                    ) : null}
                    {clientAddress?.trim() ? (
                      <p className="text-xs text-muted-foreground">
                        {clientAddress.trim()}
                      </p>
                    ) : null}
                    {signedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Signed {formatBillingDate(signedAt.slice(0, 10))}
                      </p>
                    ) : null}
                  </div>
                </div>
              </header>
            )}

            {termsMarkdown?.trim() ? (
              <ContractDocumentMarkdown>{termsMarkdown}</ContractDocumentMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">
                No agreement terms saved on this subscription.
              </p>
            )}

            {signaturePng?.startsWith("data:image/") ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Signature
                </p>
                {signatoryName?.trim() ? (
                  <p className="text-sm">{signatoryName.trim()}</p>
                ) : null}
                <img
                  src={signaturePng}
                  alt="Client signature"
                  className="max-h-28 rounded-md border bg-white"
                />
              </div>
            ) : null}
          </article>
        </div>
        {canDownload ? (
          <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-8">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <Download className="size-3.5" />
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
