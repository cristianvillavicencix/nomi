import { describe, expect, it } from "vitest";
import {
  clientInvoicePaymentFromProposalInstallment,
  parseProposalOnlinePaymentSetup,
} from "./proposalInvoicePaymentBridge.ts";

describe("clientInvoicePaymentFromProposalInstallment", () => {
  const depositAutoSetup = parseProposalOnlinePaymentSetup({
    paymentScheduleConfig: {
      paymentMode: "deposit_auto",
      depositPercent: 50,
      saveCard: true,
      remainderSchedule: {
        timing: "monthly",
        installment_count: 4,
        balance_start_date: "2026-07-01",
        project_end_date: "2026-07-01",
      },
    },
    depositPercent: 50,
    anchorDate: "2026-07-01",
  });

  it("uses upfront_percent 100 for deposit installments", () => {
    const fields = clientInvoicePaymentFromProposalInstallment(
      depositAutoSetup,
      {
        label: "Deposit (50%)",
        installment_number: 1,
        due_date: "2026-07-01",
      },
    );

    expect(fields.upfront_percent).toBe(100);
  });

  it("uses upfront_percent 100 for balance installments (DB requires > 0)", () => {
    const fields = clientInvoicePaymentFromProposalInstallment(
      depositAutoSetup,
      {
        label: "Installment 1 of 4",
        installment_number: 2,
        due_date: "2026-08-01",
      },
    );

    expect(fields.upfront_percent).toBe(100);
    expect(fields.auto_charge_remainder).toBe(true);
  });
});
