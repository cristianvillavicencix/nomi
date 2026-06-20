import { useIsMobile } from "@/hooks/use-mobile";
import {
  computeInvoiceBalanceDue,
} from "@/modules/billing/invoicePaymentUtils";
import {
  formatInvoiceDueDate,
  formatInvoiceMoney,
  type InvoiceEmailTemplateContext,
} from "@/modules/billing/invoiceEmailTemplate";
import { Mail, MessageSquare } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const EmailPreviewPanel = ({
  subject,
  emailHtml,
  emailTo,
  showHeader = true,
}: {
  subject: string;
  emailHtml: string;
  emailTo: string;
  showHeader?: boolean;
}) => (
  <div className="space-y-2">
    {showHeader ? (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Mail className="size-4 text-muted-foreground" />
        Email preview
        {emailTo ? (
          <span className="truncate text-xs font-normal text-muted-foreground">
            {emailTo}
          </span>
        ) : null}
      </div>
    ) : null}
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Subject:</span>{" "}
        {subject || "—"}
      </div>
      <div className="h-[240px] overflow-hidden bg-[#fafafa] lg:h-[280px]">
        <iframe
          title="Invoice email preview"
          srcDoc={emailHtml}
          sandbox=""
          className="h-[480px] w-[200%] origin-top-left scale-50 border-0 lg:h-[560px]"
        />
      </div>
      <div className="border-t bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
        PDF invoice attached
      </div>
    </div>
  </div>
);

const SmsPreviewPanel = ({
  smsText,
  smsTo,
  sendSms,
  showHeader = true,
}: {
  smsText: string;
  smsTo: string;
  sendSms: boolean;
  showHeader?: boolean;
}) => (
  <div className="space-y-2">
    {showHeader ? (
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="size-4 text-muted-foreground" />
        Text message
        {sendSms && smsTo ? (
          <span className="truncate text-xs font-normal text-muted-foreground">
            {smsTo}
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">Off</span>
        )}
      </div>
    ) : null}
    {sendSms && smsTo.trim() ? (
      <div className="flex justify-end">
        <div className="max-w-[92%] rounded-none rounded-br-md border border-border bg-muted/50 px-3 py-2.5 text-[12px] leading-relaxed text-foreground dark:bg-muted/30">
          <p className="whitespace-pre-wrap">{smsText}</p>
        </div>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        Turn on text message and add a mobile number to preview the SMS.
      </p>
    )}
  </div>
);

export const InvoiceSendDeliveryPreview = ({
  subject,
  emailHtml,
  smsText,
  emailTo,
  smsTo,
  sendSms,
}: {
  subject: string;
  emailHtml: string;
  smsText: string;
  emailTo: string;
  smsTo: string;
  sendSms: boolean;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Previews</p>
        <Accordion type="multiple" className="rounded-lg border px-3">
          <AccordionItem value="email" className="border-b-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Mail className="size-4 text-muted-foreground" />
                Email
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <EmailPreviewPanel
                subject={subject}
                emailHtml={emailHtml}
                emailTo={emailTo}
                showHeader={false}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="text" className="border-b-0 border-t">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="size-4 text-muted-foreground" />
                Text message
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <SmsPreviewPanel
                smsText={smsText}
                smsTo={smsTo}
                sendSms={sendSms}
                showHeader={false}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EmailPreviewPanel
        subject={subject}
        emailHtml={emailHtml}
        emailTo={emailTo}
      />
      <SmsPreviewPanel smsText={smsText} smsTo={smsTo} sendSms={sendSms} />
    </div>
  );
};

export const buildInvoiceSendFooterSummary = ({
  templateContext,
}: {
  templateContext: InvoiceEmailTemplateContext;
}) => {
  const { invoice } = templateContext;
  const balanceDue = computeInvoiceBalanceDue(
    Number(invoice.amount) || 0,
    Number(invoice.amount_paid) || 0,
  );

  return `${formatInvoiceMoney(balanceDue, invoice.currency)} due ${formatInvoiceDueDate(invoice.due_date)}`;
};
