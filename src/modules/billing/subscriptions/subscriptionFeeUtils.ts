import {
  calculateTransferFee,
  STRIPE_TRANSFER_FEE_LABEL,
} from "@/modules/billing/invoiceLineUtils";

export { STRIPE_TRANSFER_FEE_LABEL };

/** Net list price → Stripe processing fee → what the client is charged. */
export const subscriptionChargeFromNet = (netAmount: number) => {
  const subtotal = Math.round((Number(netAmount) || 0) * 100) / 100;
  const feeAmount = subtotal > 0 ? calculateTransferFee(subtotal) : 0;
  const total = Math.round((subtotal + feeAmount) * 100) / 100;
  return { subtotal, feeAmount, total };
};

export const formatSubscriptionMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0);

type GrossUpLine = { quantity: number; unit_price: number };

/** Same proportional gross-up used by Stripe subscription price_data. */
export const grossUpSubscriptionLinePrices = <T extends GrossUpLine>(
  lines: T[],
): T[] => {
  if (lines.length === 0) return lines;
  const net = lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0,
  );
  if (net <= 0) return lines;
  const { total: gross } = subscriptionChargeFromNet(net);
  const factor = gross / net;
  const inflated = lines.map((line) => ({
    ...line,
    unit_price: Math.round(line.unit_price * factor * 100) / 100,
  }));
  const inflatedSum = inflated.reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0,
  );
  const drift = Math.round((gross - inflatedSum) * 100) / 100;
  if (drift !== 0) {
    const last = inflated[inflated.length - 1];
    const qty = Math.max(1, last.quantity);
    last.unit_price = Math.round((last.unit_price + drift / qty) * 100) / 100;
  }
  return inflated;
};
