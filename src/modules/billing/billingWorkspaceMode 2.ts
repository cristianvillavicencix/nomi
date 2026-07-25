/** Split invoice workspace (`/billing?invoice=…`) — fixed chrome, internal scroll panes. */
export const isBillingInvoiceWorkspace = (pathname: string, search: string) =>
  pathname === "/billing" &&
  Boolean(new URLSearchParams(search).get("invoice"));
