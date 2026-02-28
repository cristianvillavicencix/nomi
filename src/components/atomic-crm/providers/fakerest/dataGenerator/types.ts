import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Payment,
  PaymentLine,
  Person,
  Sale,
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
  sales: Sale[];
  people: Person[];
  tags: Tag[];
  tasks: Task[];
  time_entries: TimeEntry[];
  payments: Payment[];
  payment_lines: PaymentLine[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
