import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSTALLMENT_FREQUENCIES } from "@/lbs/proposals/proposalCommercialConstants";
import {
  generatePaymentInstallments,
  type PaymentScheduleConfig,
} from "@/lbs/proposals/proposalCommercialUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";

export const ProposalPaymentSchedulePanel = ({
  config,
  onChange,
  depositAmount,
  balanceAmount,
}: {
  config: PaymentScheduleConfig;
  onChange: (config: PaymentScheduleConfig) => void;
  depositAmount: number;
  balanceAmount: number;
}) => {
  const preview = generatePaymentInstallments({
    depositAmount,
    balanceAmount,
    config,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Balance frequency</Label>
            <Select
              value={config.installment_frequency}
              onValueChange={(value) =>
                onChange({
                  ...config,
                  installment_frequency:
                    value as PaymentScheduleConfig["installment_frequency"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTALLMENT_FREQUENCIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Installments (balance)</Label>
            <Input
              type="number"
              min={1}
              max={52}
              value={config.installment_count}
              onChange={(event) =>
                onChange({
                  ...config,
                  installment_count: Math.max(
                    1,
                    Number(event.target.value) || 1,
                  ),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Deposit due date</Label>
            <Input
              type="date"
              value={config.deposit_due_date ?? ""}
              onChange={(event) =>
                onChange({
                  ...config,
                  deposit_due_date: event.target.value || null,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Balance start date</Label>
            <Input
              type="date"
              value={config.balance_start_date ?? ""}
              onChange={(event) =>
                onChange({
                  ...config,
                  balance_start_date: event.target.value || null,
                })
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.installment_number} className="border-b">
                  <td className="px-3 py-2">{row.installment_number}</td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{row.due_date}</td>
                  <td className="px-3 py-2 text-right">
                    <MoneyText value={row.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
