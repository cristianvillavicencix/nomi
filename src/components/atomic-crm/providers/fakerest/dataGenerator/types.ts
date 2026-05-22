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
  Proposal,
  ProposalLineItem,
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
  contracts: Contract[];
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
