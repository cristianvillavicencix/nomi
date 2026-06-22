import type {
  DeliverableBillingInput,
  DeliverableBillingKind,
} from "@/modules/tickets/supplementPricing";
import {
  buildDeliverableLineDescription,
  normalizePropertyAddress,
} from "@/modules/tickets/supplementPricing";

const PAYMENT_CTA =
  "Please pay using the secure link below. Your files will be delivered automatically by email after payment.";

const SMS_SERVICE_SUBJECT: Record<DeliverableBillingKind, string> = {
  supplement: "Xactimate supplement",
  siding: "siding measurement",
  roof: "roof measurement",
  esx: "ESX file",
  pdf_analysis: "PDF analysis",
};

const SINGLE_ITEM_COPY: Record<
  DeliverableBillingKind,
  { subjectLabel: string; readyMessage: string; deliverySubject: string }
> = {
  supplement: {
    subjectLabel: "Invoice for supplement",
    readyMessage: "Your Xactimate supplement is ready.",
    deliverySubject: "Your supplement files are ready",
  },
  siding: {
    subjectLabel: "Invoice for siding measurement",
    readyMessage: "Your siding measurement is ready.",
    deliverySubject: "Your siding measurement files are ready",
  },
  roof: {
    subjectLabel: "Invoice for roof measurement",
    readyMessage: "Your roof measurement is ready.",
    deliverySubject: "Your roof measurement files are ready",
  },
  esx: {
    subjectLabel: "Invoice for ESX creation",
    readyMessage: "Your ESX file is ready.",
    deliverySubject: "Your ESX files are ready",
  },
  pdf_analysis: {
    subjectLabel: "Invoice for PDF analysis",
    readyMessage: "Your PDF analysis is ready.",
    deliverySubject: "Your PDF analysis files are ready",
  },
};

export type TicketPaymentCopy = {
  subject: string;
  message: string;
  deliverySubject: string;
  serviceLines: string[];
};

const billedDeliverables = (deliverables: DeliverableBillingInput[]) =>
  deliverables.filter((item) => item.billing_kind);

export const buildTicketPaymentCopyFromDeliverables = (
  deliverables: DeliverableBillingInput[],
  propertyAddress: string,
): TicketPaymentCopy => {
  const address = normalizePropertyAddress(propertyAddress);
  const billed = billedDeliverables(deliverables);
  const serviceLines = billed.map((item) =>
    buildDeliverableLineDescription(
      item.billing_kind as DeliverableBillingKind,
      address,
      item.billing_line_count,
    ),
  );

  if (billed.length === 1) {
    const kind = billed[0].billing_kind as DeliverableBillingKind;
    const copy = SINGLE_ITEM_COPY[kind];
    return {
      subject: `${copy.subjectLabel} (${address})`,
      message: `${copy.readyMessage}\n\n${PAYMENT_CTA}`,
      deliverySubject: `${copy.deliverySubject} (${address})`,
      serviceLines,
    };
  }

  if (billed.length > 1) {
    return {
      subject: `Invoice for services (${address})`,
      message: `Your project deliverables are ready.\n\n${PAYMENT_CTA}`,
      deliverySubject: `Your project files are ready (${address})`,
      serviceLines,
    };
  }

  return {
    subject: `Invoice for services (${address})`,
    message: `Your project deliverables are ready.\n\n${PAYMENT_CTA}`,
    deliverySubject: `Your project files are ready (${address})`,
    serviceLines: [],
  };
};

export const resolveTicketSmsServiceSubject = (
  deliverables: DeliverableBillingInput[],
  propertyAddress?: string | null,
) => {
  const billed = billedDeliverables(deliverables);
  if (billed.length === 1) {
    return SMS_SERVICE_SUBJECT[billed[0].billing_kind as DeliverableBillingKind];
  }
  if (billed.length > 1) return "project deliverables";
  const address = propertyAddress?.trim();
  return address || "project";
};

export const buildTicketPaymentSmsText = (params: {
  orgName: string;
  paymentUrl: string;
  recipientFirstName?: string | null;
  serviceSubject: string;
}) => {
  const greeting = params.recipientFirstName?.trim()
    ? `Hi ${params.recipientFirstName.trim()},`
    : "Hi,";
  return `${greeting} your ${params.serviceSubject} is completed. Pay here ${params.paymentUrl} to receive your files. ${params.orgName}.`;
};

export const buildTicketPaymentReminderSmsText = (params: {
  orgName: string;
  paymentUrl: string;
  recipientFirstName?: string | null;
  serviceSubject: string;
}) => {
  const greeting = params.recipientFirstName?.trim()
    ? `Hi ${params.recipientFirstName.trim()},`
    : "Hi,";
  return `${greeting} your ${params.serviceSubject} invoice is still unpaid. Pay here ${params.paymentUrl} to receive your files. ${params.orgName}.`;
};

export const buildTicketPaymentReminderCopyFromDeliverables = (
  deliverables: DeliverableBillingInput[],
  propertyAddress: string,
): TicketPaymentCopy => {
  const base = buildTicketPaymentCopyFromDeliverables(
    deliverables,
    propertyAddress,
  );
  const reminderIntro =
    base.serviceLines.length === 1
      ? "This is a friendly reminder that your invoice is still unpaid."
      : "This is a friendly reminder that your services invoice is still unpaid.";

  return {
    ...base,
    subject: `Reminder: ${base.subject}`,
    message: `${reminderIntro}\n\n${PAYMENT_CTA}`,
  };
};
