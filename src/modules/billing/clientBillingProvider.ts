import type { Identifier } from "ra-core";

export type MarkPaidParams = {
  installmentId: Identifier;
  paymentMethod?: string;
  markedByMemberId?: Identifier | null;
};

export type CreateDepositChargeParams = {
  proposalId: Identifier;
  contractId?: Identifier | null;
  amount: number;
  currency?: string;
};

export type CreateDepositChargeResult = {
  mode: "manual" | "stripe";
  skipped: boolean;
  checkoutUrl?: string | null;
  paymentIntentId?: string | null;
};

export interface ClientBillingProvider {
  readonly mode: "manual" | "stripe";
  isSkipped(): boolean;
  createDepositCharge(
    params: CreateDepositChargeParams,
  ): Promise<CreateDepositChargeResult>;
  markInstallmentPaid(params: MarkPaidParams): Promise<void>;
}

export const isClientBillingSkipped = () => {
  const flag = import.meta.env.VITE_SKIP_CLIENT_BILLING;
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
};

class ManualClientBillingProvider implements ClientBillingProvider {
  readonly mode = "manual" as const;

  isSkipped() {
    return isClientBillingSkipped();
  }

  async createDepositCharge(): Promise<CreateDepositChargeResult> {
    return {
      mode: "manual",
      skipped: this.isSkipped(),
      checkoutUrl: null,
      paymentIntentId: null,
    };
  }

  async markInstallmentPaid(_params: MarkPaidParams): Promise<void> {
    /* Updated via standard dataProvider update on proposal_payment_installments */
  }
}

class StripeClientBillingProvider implements ClientBillingProvider {
  readonly mode = "stripe" as const;

  isSkipped() {
    return isClientBillingSkipped();
  }

  async createDepositCharge(
    _params: CreateDepositChargeParams,
  ): Promise<CreateDepositChargeResult> {
    if (this.isSkipped()) {
      return {
        mode: "stripe",
        skipped: true,
        checkoutUrl: null,
        paymentIntentId: null,
      };
    }
    return {
      mode: "stripe",
      skipped: false,
      checkoutUrl: null,
      paymentIntentId: null,
    };
  }

  async markInstallmentPaid(_params: MarkPaidParams): Promise<void> {
    /* Public portal uses pay_proposal_deposit edge function */
  }
}

export const getClientBillingProvider = (
  mode: "manual" | "stripe" = "manual",
): ClientBillingProvider =>
  mode === "stripe"
    ? new StripeClientBillingProvider()
    : new ManualClientBillingProvider();
