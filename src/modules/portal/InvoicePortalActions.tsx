import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InvoicePortalActionsProps = {
  isPaid: boolean;
  balanceFormatted: string;
  downloading: boolean;
  onPay: () => void;
  onDownload: () => void;
  layout: "toolbar" | "sticky";
};

export const InvoicePortalActions = ({
  isPaid,
  balanceFormatted,
  downloading,
  onPay,
  onDownload,
  layout,
}: InvoicePortalActionsProps) => {
  const sticky = layout === "sticky";

  if (sticky) {
    if (isPaid) {
      return (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur lg:hidden",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="p-3">
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-xl text-base"
              disabled={downloading}
              onClick={onDownload}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Download invoice"
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur lg:hidden",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <p className="border-b px-4 py-2.5 text-center text-sm text-slate-600">
          Amount due:{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {balanceFormatted}
          </span>
        </p>
        <div className="p-3">
          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-warning text-base font-semibold text-warning-foreground hover:bg-warning/90"
            onClick={onPay}
          >
            Pay now · {balanceFormatted}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 hidden flex-col gap-2 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
      {isPaid ? (
        <span className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/15 px-3 py-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" />
          Paid in full
        </span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={downloading}
        onClick={onDownload}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Download invoice"
        )}
      </Button>
      {!isPaid ? (
        <Button
          type="button"
          size="sm"
          className="bg-warning text-warning-foreground hover:bg-warning/90"
          onClick={onPay}
        >
          Pay now
        </Button>
      ) : null}
    </div>
  );
};
