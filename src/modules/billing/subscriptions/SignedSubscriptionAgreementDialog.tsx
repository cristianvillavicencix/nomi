import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";

type SignedSubscriptionAgreementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termsMarkdown?: string | null;
  signatoryName?: string | null;
  signedAt?: string | null;
  signaturePng?: string | null;
};

export function SignedSubscriptionAgreementDialog({
  open,
  onOpenChange,
  termsMarkdown,
  signatoryName,
  signedAt,
  signaturePng,
}: SignedSubscriptionAgreementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Signed agreement</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {signatoryName || signedAt ? (
            <div className="space-y-1 text-sm">
              {signatoryName ? (
                <p>
                  <span className="text-muted-foreground">Signed by </span>
                  {signatoryName}
                </p>
              ) : null}
              {signedAt ? (
                <p className="text-muted-foreground">
                  {formatBillingDate(signedAt.slice(0, 10))}
                </p>
              ) : null}
            </div>
          ) : null}
          {termsMarkdown?.trim() ? (
            <div className="rounded-lg border bg-white px-4 py-4 sm:px-5">
              <ContractDocumentMarkdown>{termsMarkdown}</ContractDocumentMarkdown>
            </div>
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
              <img
                src={signaturePng}
                alt="Client signature"
                className="max-h-32 rounded-md border bg-white"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
