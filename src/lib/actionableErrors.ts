export interface ActionableError {
  message: string;
  action?: string;
  actionHref?: string;
}

const commonPatterns: Record<string, { message: string; action?: string }> = {
  "Stripe is not configured": {
    message: "Payment processing is not configured for this organization.",
    action: "Configure Stripe in Settings → Integrations.",
  },
  "Email is not configured": {
    message: "Receipt email cannot be sent because email is not configured.",
    action: "Configure Twilio email in Settings → Integrations.",
  },
  "Email is not configured for your organization": {
    message: "Invoice email cannot be sent because email is not configured.",
    action: "Configure Twilio email in Settings → Integrations.",
  },
  "SMS is not enabled": {
    message: "SMS notification cannot be sent.",
    action: "Enable SMS in Settings → Integrations if you need it.",
  },
  "no_email": {
    message: "No email address is available for the recipient.",
    action: "Add an email to the contact before sending.",
  },
  "no_phone": {
    message: "No phone number is available for SMS delivery.",
    action: "Add a phone to the contact or disable SMS.",
  },
  "Already paid": {
    message: "This invoice has already been paid.",
    action: "Refresh the page or contact support if files were not delivered.",
  },
  "invoice already paid": {
    message: "This invoice has already been paid.",
    action: "Refresh the page or contact support if files were not delivered.",
  },
  "Failed to deliver": {
    message: "Payment succeeded, but file delivery failed.",
    action: "Check Settings → Integrations and contact support if the issue persists.",
  },
  "Could not prepare invoice": {
    message: "The invoice could not be prepared.",
    action: "Try again or refresh the page.",
  },
};

export function toActionableError(error: unknown): ActionableError {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  for (const [pattern, mapped] of Object.entries(commonPatterns)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) {
      return { ...mapped, message: `${mapped.message} (${raw})` };
    }
  }

  return {
    message: raw,
    action: "If this keeps happening, contact support with the error above.",
  };
}

export function isKnownInvoiceError(error: unknown): boolean {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return Object.keys(commonPatterns).some((pattern) =>
    raw.toLowerCase().includes(pattern.toLowerCase()),
  );
}