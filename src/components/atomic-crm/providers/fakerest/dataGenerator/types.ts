import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  EmployeeLoan,
  EmployeeLoanDeduction,
  EmployeePtoAdjustment,
  Payment,
  PaymentLine,
  PayrollRun,
  PayrollRunLine,
  Person,
  OrganizationMember,
  Tag,
  TimeEntry,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Required<Company>[];
  contacts: Required<Contact>[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  organizationMembers: OrganizationMember[];
  people: Person[];
  tags: Tag[];
  tasks: Task[];
  time_entries: TimeEntry[];
  payments: Payment[];
  payment_lines: PaymentLine[];
  payroll_runs: PayrollRun[];
  payroll_run_lines: PayrollRunLine[];
  employee_loans: EmployeeLoan[];
  employee_loan_deductions: EmployeeLoanDeduction[];
  employee_pto_adjustments: EmployeePtoAdjustment[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
