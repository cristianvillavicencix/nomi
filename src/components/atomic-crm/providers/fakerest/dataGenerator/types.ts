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
  TaskAssignee,
  TaskParticipant,
  TaskTagNotification,
  CalendarEventRecord,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";
import type {
  Contract,
  Form,
  FormSubmission,
  OrganizationContractTerms,
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
  ProposalPaymentSchedule,
  ServiceAddon,
  ServicePackage,
  Ticket,
  TicketMessage,
  DealResource,
  DealAccessEntry,
  Conversation,
  ConversationParticipant,
  ConversationMessage,
} from "@/lbs/types";

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
  task_assignees: TaskAssignee[];
  task_participants: TaskParticipant[];
  task_tag_notifications: TaskTagNotification[];
  calendar_events: CalendarEventRecord[];
  time_entries: TimeEntry[];
  payments: Payment[];
  payment_lines: PaymentLine[];
  payroll_runs: PayrollRun[];
  payroll_run_lines: PayrollRunLine[];
  employee_loans: EmployeeLoan[];
  employee_loan_deductions: EmployeeLoanDeduction[];
  employee_pto_adjustments: EmployeePtoAdjustment[];
  proposals: Proposal[];
  proposal_line_items: ProposalLineItem[];
  proposal_payment_schedules: ProposalPaymentSchedule[];
  proposal_payment_installments: ProposalPaymentInstallment[];
  service_packages: ServicePackage[];
  service_addons: ServiceAddon[];
  organization_contract_terms: OrganizationContractTerms[];
  contracts: Contract[];
  public_proposal_tokens: Array<{
    id: number;
    token: string;
    short_code: string;
    org_id: number;
    proposal_id: number;
    expires_at: string;
    uses_count: number;
    created_at: string;
  }>;
  deal_client_payments: Array<{
    id: number;
    deal_id: number;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference_number?: string | null;
    status: string;
    notes?: string | null;
  }>;
  maintenance_retainers: Array<{
    id: number;
    org_id: number;
    deal_id: number;
    monthly_hours_included: number;
    monthly_amount: number;
    notes?: string | null;
    active: boolean;
  }>;
  forms: Form[];
  form_submissions: FormSubmission[];
  tickets: Ticket[];
  ticket_messages: TicketMessage[];
  conversations: Conversation[];
  conversation_participants: ConversationParticipant[];
  conversation_messages: ConversationMessage[];
  deal_resources: DealResource[];
  deal_access_entries: DealAccessEntry[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
