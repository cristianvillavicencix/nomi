import { Clock, Mail, MessageSquare, Package } from "lucide-react";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import { formatInvoiceDueDate } from "@/modules/billing/invoiceEmailTemplate";

const DeliveryEmailPreviewPanel = ({
  subject,
  emailHtml,
  emailTo,
  fileCount,
}: {
  subject: string;
  emailHtml: string;
  emailTo: string;
  fileCount: number;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-medium">
      <Package className="size-4 text-muted-foreground" />
      After payment
      <span className="text-xs font-normal text-muted-foreground">
        Email with {fileCount} file{fileCount === 1 ? "" : "s"} attached
      </span>
    </div>
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Subject:</span>{" "}
        {subject || "—"}
        {emailTo ? (
          <span className="ml-2 text-muted-foreground">To: {emailTo}</span>
        ) : null}
      </div>
      <div className="h-[200px] overflow-hidden bg-[#fafafa] lg:h-[220px]">
        <iframe
          title="Ticket delivery email preview"
          srcDoc={emailHtml}
          sandbox=""
          className="h-[400px] w-[200%] origin-top-left scale-50 border-0 lg:h-[440px]"
        />
      </div>
      <div className="border-t bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
        Sent automatically when the client pays — not included in the payment
        email.
      </div>
    </div>
  </div>
);

export const TicketInvoiceSendPreview = ({
  paymentSubject,
  paymentEmailHtml,
  paymentSmsText,
  deliverySubject,
  deliveryEmailHtml,
  emailTo,
  smsTo,
  sendSms,
  fileCount,
}: {
  paymentSubject: string;
  paymentEmailHtml: string;
  paymentSmsText: string;
  deliverySubject: string;
  deliveryEmailHtml: string;
  emailTo: string;
  smsTo: string;
  sendSms: boolean;
  fileCount: number;
}) => (
  <div className="space-y-5">
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Mail className="size-3.5" />
      Payment request
    </div>
    <InvoiceSendDeliveryPreview
      subject={paymentSubject}
      emailHtml={paymentEmailHtml}
      smsText={paymentSmsText}
      emailTo={emailTo}
      smsTo={smsTo}
      sendSms={sendSms}
    />
    <div className="flex items-center gap-2 border-t pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Clock className="size-3.5" />
      After payment
      <MessageSquare className="ml-auto size-3.5 opacity-60" />
    </div>
    <DeliveryEmailPreviewPanel
      subject={deliverySubject}
      emailHtml={deliveryEmailHtml}
      emailTo={emailTo}
      fileCount={fileCount}
    />
  </div>
);

export const buildTicketSendFooterSummary = (
  amountFormatted: string,
  dueDate: string,
) => `${amountFormatted} due ${formatInvoiceDueDate(dueDate)}`;
