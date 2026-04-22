import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: RAFile | null;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  roles?: string[];
  disabled: boolean;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  roles?: string[];
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier | null;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  address?: string | null;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: Identifier[];
  gender: string;
  sales_id?: Identifier | null;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  company_name?: string | null;
  contact_id?: Identifier | null;
  contact_ids: Identifier[];
  pipeline_id?: string;
  category: string;
  project_type?: string | null;
  stage: string;
  description: string;
  notes?: string | null;
  amount: number;
  estimated_value?: number | null;
  original_project_value?: number | null;
  current_project_value?: number | null;
  value_includes_material?: boolean;
  project_address?: string | null;
  project_place_id?: string | null;
  project_address_meta?: Record<string, unknown> | null;
  salesperson_ids?: Identifier[];
  subcontractor_ids?: Identifier[];
  worker_ids?: Identifier[];
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_completion_date?: string | null;
  estimated_completion_time?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  sales_id: Identifier;
  index: number;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type Person = {
  org_id: number;
  type: "employee" | "salesperson" | "subcontractor";
  first_name: string;
  last_name: string;
  identification_number?: string | null;
  business_name?: string | null;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status: "active" | "inactive";
  compensation_mode?: "hourly" | "salary" | "day_rate" | null;
  compensation_unit?: "hour" | "day" | "week" | "month" | "commission" | null;
  compensation_amount?: number | null;
  pay_type: "hourly" | "salary" | "commission" | "day_rate";
  compensation_type?:
    | "hourly"
    | "daily"
    | "weekly_salary"
    | "biweekly_salary"
    | "monthly_salary"
    | "commission";
  employee_status?: "active" | "inactive";
  payment_method?: "cash" | "check" | "zelle" | "bank_deposit" | null;
  annual_salary?: number | null;
  bank_account_holder_name?: string | null;
  bank_name?: string | null;
  routing_number?: string | null;
  account_number?: string | null;
  account_type?: "checking" | "savings" | null;
  zelle_account_holder_name?: string | null;
  zelle_contact?: string | null;
  check_pay_to_name?: string | null;
  bank_account_holder?: string | null;
  bank_account_type?: "checking" | "savings" | null;
  bank_routing_number?: string | null;
  bank_account_number?: string | null;
  hourly_rate?: number | null;
  salary_rate?: number | null;
  day_rate?: number | null;
  commission_rate?: number | null;
  weekly_salary_amount?: number | null;
  biweekly_salary_amount?: number | null;
  monthly_salary_amount?: number | null;
  salary_amount?: number | null;
  default_hours_per_week?: number | null;
  overtime_enabled?: boolean | null;
  overtime_rate_multiplier?: number | null;
  lunch_break_deducted?: boolean | null;
  default_lunch_minutes?: number | null;
  paid_day_hours?: number | null;
  working_days_per_week?: number | null;
  off_days_paid?: boolean | null;
  holidays_paid?: boolean | null;
  sick_days_paid?: boolean | null;
  vacation_days_paid?: boolean | null;
  sick_balance_days?: number | null;
  vacation_balance_days?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  emergency_notes?: string | null;
  pay_schedule?: "weekly" | "biweekly" | "semimonthly" | "monthly" | null;
  default_hours_per_week?: number | null;
  default_work_days?: number[] | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type TimeEntry = {
  org_id: number;
  person_id: Identifier;
  project_id?: Identifier | null;
  date: string;
  hours: number;
  lunch_minutes?: number | null;
  break_minutes?: number | null; // legacy alias
  worked_hours_raw?: number | null;
  payable_hours?: number | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  work_location?: string | null;
  work_type?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "rejected"
    | "included_in_payroll"
    | "paid";
  day_type?:
    | "worked_day"
    | "holiday"
    | "sick_day"
    | "vacation_day"
    | "day_off"
    | "unpaid_leave";
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  included_in_payroll?: boolean | null;
  payment_run_id?: Identifier | null;
  /** Set when this entry is included in a payroll run */
  payroll_run_id?: Identifier | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type Payment = {
  org_id: number;
  payroll_run_id?: Identifier | null;
  run_name?: string | null;
  category?:
    | "hourly"
    | "salaried"
    | "subcontractor"
    | "sales_commissions"
    | "mixed"
    | null;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: "draft" | "approved" | "paid";
  notes?: string | null;
  created_by?: string | null;
  total_gross?: number | null;
  total_net?: number | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  /** Optional proof image URL when the run was approved */
  approved_receipt_url?: string | null;
  /** Proof image URL when marked paid (check photo, Zelle screenshot, etc.) */
  paid_receipt_url?: string | null;
} & Pick<RaRecord, "id">;

export type PayrollRun = {
  org_id: number;
  employee_id?: Identifier | null;
  category:
    | "hourly"
    | "salaried"
    | "subcontractor"
    | "sales_commissions"
    | "mixed";
  pay_schedule: "weekly" | "biweekly" | "semimonthly" | "monthly";
  pay_period_start: string;
  pay_period_end: string;
  payday: string;
  status: "draft" | "reviewed" | "approved" | "paid" | "cancelled";
  created_by?: string | null;
  notes?: string | null;
  /** Set when status becomes cancelled (from the Cancel run dialog). */
  cancellation_reason?: string | null;
  created_at?: string;
  approved_at?: string | null;
  paid_at?: string | null;
  /** When set, footer uses this total for deductions / net instead of summing line totals. */
  manual_deduction_total?: number | null;
} & Pick<RaRecord, "id">;

export type PayrollRunLine = {
  payroll_run_id: Identifier;
  employee_id: Identifier;
  compensation_unit?: "hour" | "day" | "week" | "month" | null;
  compensation_amount?: number | null;
  compensation_type:
    | "hourly"
    | "daily"
    | "weekly_salary"
    | "biweekly_salary"
    | "monthly_salary";
  payment_method: "cash" | "check" | "zelle" | "bank_deposit";
  regular_hours?: number | null;
  overtime_hours?: number | null;
  paid_leave_hours?: number | null;
  base_salary_amount?: number | null;
  unpaid_absence_deduction?: number | null;
  loan_deductions?: number | null;
  other_deductions?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  payment_reference?: string | null;
  payment_notes?: string | null;
} & Pick<RaRecord, "id">;

export type EmployeeLoan = {
  employee_id: Identifier;
  record_type?: "advance" | "loan";
  status?: "active" | "paused" | "completed" | "cancelled";
  loan_date: string;
  first_deduction_date?: string | null;
  original_amount: number;
  remaining_balance: number;
  fixed_installment_amount: number;
  active: boolean;
  paused: boolean;
  start_next_payroll: boolean;
  deduction_mode?: "fixed_installment" | "single_next_payroll";
  payment_count?: number | null;
  repayment_schedule?: "next_payroll" | "specific_pay_date";
  disbursement_receipt_number?: string | null;
  disbursement_receipt_generated_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  reason?: string | null;
} & Pick<RaRecord, "id">;

export type EmployeeLoanDeduction = {
  loan_id: Identifier;
  payroll_run_id?: Identifier | null;
  deduction_date: string;
  scheduled_amount: number;
  deducted_amount: number;
  remaining_balance_after: number;
  receipt_number?: string | null;
  receipt_generated_at?: string | null;
  notes?: string | null;
} & Pick<RaRecord, "id">;

export type EmployeePtoAdjustment = {
  employee_id: Identifier;
  adjustment_date: string;
  adjustment_type: "sick" | "vacation";
  days_delta: number;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type PaymentLine = {
  payment_id: Identifier;
  person_id: Identifier;
  project_id?: Identifier | null;
  compensation_unit?: "hour" | "day" | "week" | "month" | "commission" | null;
  compensation_amount?: number | null;
  compensation_type?:
    | "hourly"
    | "daily"
    | "weekly_salary"
    | "monthly_salary"
    | "fixed_salary"
    | "commission"
    | null;
  source_type: "time_entry" | "salary" | "commission" | "adjustment";
  source_reference?: string | null;
  source_id?: Identifier | null;
  qty_hours?: number | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  rate?: number | null;
  regular_pay?: number | null;
  overtime_pay?: number | null;
  bonuses?: number | null;
  deductions?: number | null;
  total_pay?: number | null;
  amount: number;
  notes?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type DealSubcontractorEntry = {
  deal_id: Identifier;
  person_id: Identifier;
  status: "pending" | "approved" | "in_progress" | "completed" | "paid";
  invoice_number?: string | null;
  invoice_attachments?: RAFile[];
  cost_amount: number;
  material_included?: boolean;
  estimated_completion_date?: string | null;
  start_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealExpense = {
  deal_id: Identifier;
  expense_type: string;
  vendor?: string | null;
  description?: string | null;
  amount: number;
  purchase_date?: string | null;
  paid: boolean;
  attachments?: RAFile[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealChangeOrder = {
  deal_id: Identifier;
  title: string;
  description?: string | null;
  change_date: string;
  amount: number;
  reason?: string | null;
  status: "draft" | "sent" | "approved" | "rejected";
  attachments?: RAFile[];
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealCommission = {
  deal_id: Identifier;
  salesperson_id: Identifier;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  basis: "payments_collected" | "custom";
  paid: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealClientPayment = {
  deal_id: Identifier;
  payment_date: string;
  amount: number;
  payment_method: "check" | "cash" | "zelle" | "ach" | "card" | "other";
  check_number?: string | null;
  reference_number?: string | null;
  status: "pending" | "cleared" | "bounced" | "deposited";
  attachments?: RAFile[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export type DealPipelineStage = {
  id: string;
  label: string;
  color: string;
  order: number;
  pipelineId: string;
  isDefault?: boolean;
};

export type DealPipeline = {
  id: string;
  label: string;
  order: number;
  isDefault?: boolean;
  stages: DealPipelineStage[];
};

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
