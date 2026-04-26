import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateOrganizationMembers } from "./organizationMembers";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.organizationMembers = generateOrganizationMembers(db);
  db.people = [];
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.time_entries = [];
  db.payments = [];
  db.payment_lines = [];
  db.payroll_runs = [];
  db.payroll_run_lines = [];
  db.employee_loans = [];
  db.employee_loan_deductions = [];
  db.employee_pto_adjustments = [];
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
