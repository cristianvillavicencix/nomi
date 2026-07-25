/** Client-side match for invoice list search (current page / loaded rows). */
export const invoiceMatchesSearchQuery = (
  invoice: {
    invoice_number?: string | null;
    amount?: number | string | null;
    description?: string | null;
  },
  companyName: string | null | undefined,
  searchQuery: string,
): boolean => {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;

  const amount = Number(invoice.amount);
  const amountText = Number.isFinite(amount)
    ? String(amount)
    : String(invoice.amount ?? "");

  return (
    (invoice.invoice_number ?? "").toLowerCase().includes(q) ||
    (companyName ?? "").toLowerCase().includes(q) ||
    amountText.toLowerCase().includes(q) ||
    (invoice.description ?? "").toLowerCase().includes(q)
  );
};
