import {
  CreateButton,
  DataTable,
  DateField,
  List,
  NumberField,
  ReferenceField,
  TextField,
} from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { useRecordContext } from "ra-core";
import type { EmployeeLoan } from "@/components/atomic-crm/types";
import {
  getLoanRecordTypeLabel,
  getLoanStatus,
  getRepaymentSummary,
} from "./helpers";

const LoansListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-2">
    <CreateButton label="New Advance / Loan" />
    <ModuleInfoPopover
      title="Loans"
      description="Advances and loans are tied to a person. Repayments usually happen automatically on payroll runs until the balance is zero."
      bullets={[
        "Create a loan and set installment amount and dates.",
        "Keep the loan active unless you pause it.",
        "Payroll applies deductions and updates the remaining balance.",
      ]}
    />
  </TopToolbar>
);

const LoanTypeField = () => {
  const record = useRecordContext<EmployeeLoan>();
  if (!record) return null;
  return <span>{getLoanRecordTypeLabel(record.record_type)}</span>;
};

const LoanStatusField = () => {
  const record = useRecordContext<EmployeeLoan>();
  if (!record) return null;
  const status = getLoanStatus(record);
  return (
    <Badge
      variant={
        status === "completed"
          ? "secondary"
          : status === "paused"
            ? "outline"
            : "default"
      }
    >
      {status}
    </Badge>
  );
};

const RepaymentField = () => {
  const record = useRecordContext<EmployeeLoan>();
  if (!record) return null;
  return <span>{getRepaymentSummary(record)}</span>;
};

export const LoansList = () => (
  <List
    title={false}
    disableBreadcrumb
    sort={{ field: "loan_date", order: "DESC" }}
    actions={<LoansListActions />}
  >
    <DataTable rowClick="show">
      <DataTable.Col label="Employee">
        <ReferenceField source="employee_id" reference="people" link={false}>
          <TextField source="last_name" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Type">
        <LoanTypeField />
      </DataTable.Col>
      <DataTable.Col source="loan_date" label="Date">
        <DateField source="loan_date" />
      </DataTable.Col>
      <DataTable.Col source="original_amount" label="Amount given">
        <NumberField
          source="original_amount"
          options={{ style: "currency", currency: "USD" }}
        />
      </DataTable.Col>
      <DataTable.Col source="remaining_balance" label="Balance">
        <NumberField
          source="remaining_balance"
          options={{ style: "currency", currency: "USD" }}
        />
      </DataTable.Col>
      <DataTable.Col label="Plan">
        <RepaymentField />
      </DataTable.Col>
      <DataTable.Col label="Status">
        <LoanStatusField />
      </DataTable.Col>
    </DataTable>
  </List>
);
