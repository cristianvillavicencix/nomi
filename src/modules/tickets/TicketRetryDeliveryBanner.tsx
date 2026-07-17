import { useDataProvider, useGetOne, useNotify, useRefresh } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClientInvoice, Ticket } from "@/modules/types";

const isPendingDelivery = (
  ticket: Ticket,
  invoice?: ClientInvoice | null,
) => {
  if (!ticket.invoice_id) return false;
  if (
    ticket.delivery_status === "delivered" ||
    ticket.delivery_status === "none" ||
    !ticket.delivery_status
  ) {
    return false;
  }
  if (!invoice) return false;
  return invoice.status === "paid";
};

export const TicketRetryDeliveryBanner = ({ ticket }: { ticket: Ticket }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: invoice } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id: ticket.invoice_id ?? "" },
    { enabled: Boolean(ticket.invoice_id) },
  );

  const deliverMutation = useMutation({
    mutationFn: () =>
      (
        dataProvider as {
          deliverTicket: (params: {
            ticketId: Ticket["id"];
          }) => Promise<unknown>;
        }
      ).deliverTicket({ ticketId: ticket.id }),
    onSuccess: () => {
      notify("Files delivered to client", { type: "success" });
      refresh();
    },
    onError: (error: Error) =>
      notify(
        error.message || "Could not deliver files. Try Retry delivery again.",
        { type: "error" },
      ),
  });

  if (!isPendingDelivery(ticket, invoice)) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-violet-300/50 bg-violet-50 px-4 py-2 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 md:px-5">
      <p className="min-w-0">
        <span className="font-medium">Pending delivery</span>
        <span className="text-violet-800/80 dark:text-violet-200/80">
          {" "}
          — Invoice is paid, but files were not emailed yet.
        </span>
      </p>
      <Button
        type="button"
        size="sm"
        className="shrink-0 rounded-none"
        disabled={deliverMutation.isPending}
        onClick={() => deliverMutation.mutate()}
      >
        {deliverMutation.isPending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Send className="mr-1.5 size-4" />
        )}
        Retry delivery
      </Button>
    </div>
  );
};
