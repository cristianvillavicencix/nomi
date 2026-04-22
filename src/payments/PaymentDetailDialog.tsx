import type { Identifier } from "ra-core";
import { ShowBase } from "ra-core";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentsShowContent } from "./PaymentsShow";

export function PaymentDetailDialog({
  paymentId,
  open,
  onOpenChange,
}: {
  paymentId: Identifier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && paymentId != null ? (
        <DialogContent className="flex max-h-[min(92vh,900px)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1400px,calc(100vw-1.5rem))]">
          <DialogTitle className="sr-only">
            Payment run details
          </DialogTitle>
          <DialogDescription className="sr-only">
            Payment run details and actions. Open full page for a dedicated
            screen or printing.
          </DialogDescription>
          <ShowBase
            key={String(paymentId)}
            resource="payments"
            id={paymentId}
            loading={
              <div className="space-y-4 p-6">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            }
          >
            <div className="flex shrink-0 items-center justify-end border-b px-4 py-2.5 pr-14">
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link
                  to={`/payments/${paymentId}/show`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open full page
                </Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1 sm:px-5">
              <PaymentsShowContent variant="dialog" />
            </div>
          </ShowBase>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
