export const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function maskAmountIfNeeded(
  value: number | null | undefined,
  canViewAmounts: boolean,
): string {
  if (!canViewAmounts) return "—";
  if (value == null || Number.isNaN(value)) return "—";
  return formatUsd(value);
}
