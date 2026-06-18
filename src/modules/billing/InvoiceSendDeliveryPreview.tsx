import {
  computeInvoiceBalanceDue,
  invoicePaymentModeFromRecord,
} from "@/modules/billing/invoicePaymentUtils";
import {
  formatInvoiceDueDate,
  formatInvoiceMoney,
  type InvoiceEmailTemplateContext,
} from "@/modules/billing/invoiceEmailTemplate";
import { formatContactName } from "@/modules/billing/billingUtils";
import { Mail, MessageSquare } from "lucide-react";

export const InvoiceSendDeliveryPreview = ({
  subject,
  emailHtml,
  smsText,
  emailTo,
  smsTo,
  sendSms,
  templateContext,
}: {
  subject: string;
  emailHtml: string;
  smsText: string;
  emailTo: string;
  smsTo: string;
  sendSms: boolean;
  templateContext: InvoiceEmailTemplateContext;
}) => {
  const { invoice, organizationName, lineItems } = templateContext;
  const balanceDue = computeInvoiceBalanceDue(
    Number(invoice.amount) || 0,
    Number(invoice.amount_paid) || 0,
  );
  const greetingName =
    formatContactName(templateContext.contact)?.split(" ")[0] ?? "there";
  const depositPlan =
    invoicePaymentModeFromRecord(invoice) === "deposit_auto" &&
    Number(invoice.upfront_percent ?? 100) < 100;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Mail className="size-3.5" />
          Email preview
          {emailTo ? (
            <span className="truncate font-normal">→ {emailTo}</span>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Subject:</span>{" "}
            {subject || "—"}
          </div>
          <div className="h-[300px] overflow-hidden bg-[#f1f6fb]">
            <iframe
              title="Invoice email preview"
              srcDoc={emailHtml}
              sandbox=""
              className="h-[600px] w-[200%] origin-top-left scale-50 border-0"
            />
          </div>
          <div className="border-t bg-slate-50 px-3 py-2 text-[10px] text-muted-foreground">
            PDF invoice attached · branded pay button in email
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <MessageSquare className="size-3.5" />
          Text preview
          {sendSms && smsTo ? (
            <span className="truncate font-normal">→ {smsTo}</span>
          ) : (
            <span className="font-normal">Optional</span>
          )}
        </div>
        <div className="flex min-h-[300px] flex-col rounded-lg border bg-slate-950 p-4">
          <div className="mb-3 text-center text-[10px] font-medium tracking-wide text-slate-400">
            TEXT MESSAGE
          </div>
          {sendSms && smsTo.trim() ? (
            <div className="mt-auto space-y-2">
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[#34C759] px-3 py-2.5 text-[12px] leading-relaxed text-white shadow-sm">
                <p className="whitespace-pre-wrap">{smsText}</p>
              </div>
              <p className="text-center text-[10px] text-slate-500">
                Link opens the same invoice portal as the email
              </p>
            </div>
          ) : (
            <div className="m-auto max-w-xs text-center text-xs text-slate-500">
              Add a mobile number below to also send this invoice by text.
            </div>
          )}
        </div>
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Summary:</span>{" "}
          {formatInvoiceMoney(balanceDue, invoice.currency)} due{" "}
          {formatInvoiceDueDate(invoice.due_date)}
          {lineItems[0]
            ? ` · ${lineItems[0].description.split("\n")[0]}`
            : ""}
          {depositPlan ? " · deposit schedule included in email" : ""}
          {!sendSms || !smsTo.trim()
            ? ""
            : ` · Hi ${greetingName} gets the pay link by SMS`}
        </div>
      </div>
    </div>
  );
};
