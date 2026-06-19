const storageKey = (token: string) => `nomi:invoice-checkout-pi:${token}`;

type StoredInvoiceCheckoutPayment = {
  paymentIntentId: string;
};

export const readStoredInvoicePaymentIntentId = (token: string) => {
  if (typeof window === "undefined" || !token.trim()) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvoiceCheckoutPayment;
    const paymentIntentId = parsed.paymentIntentId?.trim();
    return paymentIntentId || null;
  } catch {
    return null;
  }
};

export const writeStoredInvoicePaymentIntentId = (
  token: string,
  paymentIntentId: string,
) => {
  if (typeof window === "undefined" || !token.trim() || !paymentIntentId.trim()) {
    return;
  }
  const payload: StoredInvoiceCheckoutPayment = {
    paymentIntentId: paymentIntentId.trim(),
  };
  window.sessionStorage.setItem(storageKey(token), JSON.stringify(payload));
};

export const clearStoredInvoicePaymentIntentId = (token: string) => {
  if (typeof window === "undefined" || !token.trim()) return;
  window.sessionStorage.removeItem(storageKey(token));
};
