import { FINANCIAL_ACCESS_DENIED_MESSAGE } from "@/lib/permissions/financialVisibility";

export const FinancialAccessDenied = ({
  message = FINANCIAL_ACCESS_DENIED_MESSAGE,
  className,
}: {
  message?: string;
  className?: string;
}) => (
  <div
    className={
      className ??
      "flex min-h-[12rem] flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground"
    }
  >
    <p>{message}</p>
  </div>
);
