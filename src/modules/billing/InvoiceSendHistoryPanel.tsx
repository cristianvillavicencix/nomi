import { Mail, MessageSquare } from "lucide-react";
import type { ReactElement } from "react";
import { useGetList } from "ra-core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientInvoice, ClientInvoiceEmailLog } from "@/modules/types";
import {
  invoiceSendHistoryChannel,
  invoiceSendHistoryKind,
  invoiceSendHistoryLabel,
  invoiceSendHistoryStatusLabel,
} from "@/modules/billing/invoiceSendHistory";

const formatWhen = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const InvoiceSendHistoryPanel = ({
  invoice,
  trigger,
}: {
  invoice: ClientInvoice;
  trigger: ReactElement;
}) => {
  const { data: logs = [] } = useGetList<ClientInvoiceEmailLog>(
    "client_invoice_email_logs",
    {
      filter: { "invoice_id@eq": invoice.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "sent_at", order: "DESC" },
    },
    { enabled: Boolean(invoice.id) },
  );

  const rows = logs.map((log) => {
    const kind = invoiceSendHistoryKind(log.email_type);
    return {
      id: String(log.id),
      kind,
      label: invoiceSendHistoryLabel({
        emailType: log.email_type,
        referenceKey: log.reference_key,
      }),
      channel: invoiceSendHistoryChannel(kind),
      to: log.recipient_email,
      status: invoiceSendHistoryStatusLabel(log.delivery_status),
      sentAt: log.sent_at ?? "",
      when: formatWhen(log.sent_at),
      error: log.error_message?.trim() || null,
    };
  });

  const hasInvoiceSendLog = logs.some(
    (log) =>
      log.email_type === "invoice_sent" ||
      String(log.reference_key ?? "").startsWith("invoice_send"),
  );
  if (invoice.sent_at && !hasInvoiceSendLog) {
    rows.push({
      id: "invoice-sent",
      kind: "invoice_sent",
      label: "Invoice sent",
      channel: "Email",
      to: invoice.recipient_email?.trim() || "",
      status: "Sent",
      sentAt: invoice.sent_at,
      when: formatWhen(invoice.sent_at),
      error: null,
    });
  }

  rows.sort((left, right) => right.sentAt.localeCompare(left.sentAt));

  if (rows.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-2">
        <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Send history
        </p>
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-2 rounded-sm px-1 py-0.5 text-xs leading-snug"
            >
              {row.channel.includes("SMS") && !row.channel.includes("Email") ? (
                <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium text-foreground">
                    {row.label}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.channel} · {row.status}
                  </span>
                </p>
                <p className="truncate text-muted-foreground">
                  {[row.to, row.when].filter(Boolean).join(" · ")}
                </p>
                {row.error ? (
                  <p className="truncate text-destructive">{row.error}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

