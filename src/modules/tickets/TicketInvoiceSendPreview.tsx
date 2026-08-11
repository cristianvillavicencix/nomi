import { Clock, Mail, MessageSquare, Package } from "lucide-react";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import { formatInvoiceDueDate } from "@/modules/billing/invoiceEmailTemplate";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DeliveryEmailPreviewPanel = ({
  subject,
  emailHtml,
  emailTo,
  fileCount,
  showHeader = true,
}: {
  subject: string;
  emailHtml: string;
  emailTo: string;
  fileCount: number;
  showHeader?: boolean;
}) => (
  <div className="space-y-2">
    {showHeader ? (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Package className="size-4 text-muted-foreground" />
        After payment
        <span className="text-xs font-normal text-muted-foreground">
          Email with {fileCount} file{fileCount === 1 ? "" : "s"} attached
        </span>
      </div>
    ) : null}
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Subject:</span>{" "}
        {subject || "—"}
        {emailTo ? (
          <span className="ml-2 text-muted-foreground">To: {emailTo}</span>
        ) : null}
      </div>
      <div className="h-[160px] overflow-hidden bg-[#fafafa]">
        <iframe
          title="Ticket delivery email preview"
          srcDoc={emailHtml}
          sandbox=""
          className="h-[320px] w-[200%] origin-top-left scale-50 border-0"
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
  <div className="space-y-3">
    <p className="text-xs font-medium text-muted-foreground">Previews</p>
    <Accordion type="multiple" defaultValue={[]} className="rounded-lg border px-3">
      <AccordionItem value="payment" className="border-b-0">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-muted-foreground" />
            Payment request
            {emailTo ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {emailTo}
              </span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <InvoiceSendDeliveryPreview
            subject={paymentSubject}
            emailHtml={paymentEmailHtml}
            smsText={paymentSmsText}
            emailTo={emailTo}
            smsTo={smsTo}
            sendSms={sendSms}
            defaultCollapsed
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="delivery" className="border-b-0 border-t">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" />
            After payment
            <span className="text-xs font-normal text-muted-foreground">
              {fileCount} file{fileCount === 1 ? "" : "s"}
            </span>
            {sendSms ? (
              <MessageSquare className="ml-auto size-3.5 text-muted-foreground opacity-60" />
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <DeliveryEmailPreviewPanel
            subject={deliverySubject}
            emailHtml={deliveryEmailHtml}
            emailTo={emailTo}
            fileCount={fileCount}
            showHeader={false}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

export const buildTicketSendFooterSummary = (
  amountFormatted: string,
  dueDate: string,
) => `${amountFormatted} due ${formatInvoiceDueDate(dueDate)}`;
