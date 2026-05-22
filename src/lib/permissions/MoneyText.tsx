import type { ReactNode } from "react";
import { useMaskedAmount } from "./useMaskedAmount";

type MoneyTextProps = {
  value: number | null | undefined;
  className?: string;
};

export const MoneyText = ({ value, className }: MoneyTextProps) => {
  const text = useMaskedAmount(value);
  return <span className={className}>{text}</span>;
};

export const moneyOrDash = (
  value: number | null | undefined,
  canViewAmounts: boolean,
): ReactNode => {
  if (!canViewAmounts) return "—";
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};
