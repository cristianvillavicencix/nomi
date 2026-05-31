import { jsPDF } from "jspdf";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/lbs/types";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const exportProposalPdf = ({
  proposal,
  lineItems,
  installments,
}: {
  proposal: Proposal;
  lineItems: ProposalLineItem[];
  installments: ProposalPaymentInstallment[];
}) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = margin;
  const lineHeight = 16;
  const pageHeight = doc.internal.pageSize.getHeight();
  const currency = proposal.currency ?? "USD";

  const writeln = (
    text: string,
    options?: { bold?: boolean; size?: number },
  ) => {
    const size = options?.size ?? 11;
    doc.setFontSize(size);
    doc.setFont("helvetica", options?.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 516);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  writeln(proposal.title, { bold: true, size: 18 });
  y += 4;
  if (proposal.proposal_number) {
    writeln(`Proposal ${proposal.proposal_number}`);
  }
  writeln(`Status: ${proposal.status ?? "draft"}`);
  writeln(`Valid until: ${formatDate(proposal.valid_until)}`);
  writeln(`Total: ${formatMoney(proposal.amount ?? 0, currency)}`);
  if (proposal.deposit_amount != null) {
    writeln(`Deposit (50%): ${formatMoney(proposal.deposit_amount, currency)}`);
  }
  if (proposal.notes) {
    y += 6;
    writeln("Notes", { bold: true, size: 13 });
    writeln(proposal.notes);
  }

  y += 8;
  writeln("Line items", { bold: true, size: 13 });
  y += 4;
  for (const item of lineItems) {
    const qty = item.quantity ?? 1;
    const unit = item.unit_price ?? 0;
    const recurring =
      item.billing_type === "recurring"
        ? ` (${item.billing_interval ?? "monthly"})`
        : "";
    writeln(
      `${item.description}${recurring} — ${qty} × ${formatMoney(unit, currency)}`,
    );
  }

  if (installments.length > 0) {
    y += 8;
    writeln("Payment schedule", { bold: true, size: 13 });
    y += 4;
    for (const row of installments) {
      writeln(
        `${row.installment_number}. ${row.label} — ${formatDate(row.due_date)}: ${formatMoney(row.amount, currency)}`,
      );
    }
  }

  const filename = proposal.proposal_number
    ? `${proposal.proposal_number}.pdf`
    : `proposal-${proposal.id}.pdf`;
  doc.save(filename);
};
