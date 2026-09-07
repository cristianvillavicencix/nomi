import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContractDocumentMarkdown } from "@/modules/billing/subscriptions/ContractDocumentMarkdown";

export const SubscriptionAgreementPreviewDialog = ({
  open,
  onOpenChange,
  title,
  markdown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  markdown: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[min(94vh,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,920px)]">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
        <DialogTitle>Preview — {title}</DialogTitle>
        <DialogDescription>
          Same A4 contract document the client receives, filled with this
          subscription’s client and plan.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted">
        {markdown.trim() ? (
          <ContractDocumentMarkdown page>{markdown}</ContractDocumentMarkdown>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No terms to preview. Choose a contract template first.
          </p>
        )}
      </div>
      <DialogFooter className="shrink-0 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
