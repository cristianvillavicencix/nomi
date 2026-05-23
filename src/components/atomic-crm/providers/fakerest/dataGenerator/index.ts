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
  db.task_assignees = [];
  db.task_participants = [];
  db.task_tag_notifications = [];
  db.calendar_events = [];
  db.tasks = db.tasks.map((task) => ({
    ...task,
    mentioned_member_ids: [],
  }));
  db.time_entries = [];
  db.payments = [];
  db.payment_lines = [];
  db.payroll_runs = [];
  db.payroll_run_lines = [];
  db.employee_loans = [];
  db.employee_loan_deductions = [];
  db.employee_pto_adjustments = [];
  db.proposals = [];
  db.proposal_line_items = [];
  db.contracts = [];
  db.forms = [
    {
      id: 1,
      name: "Website & marketing intake",
      slug: "website-intake",
      description:
        "Collect website and marketing project requirements from clients.",
      active: true,
      schema: { type: "brief" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      name: "Project Resources Upload",
      slug: "project-resources",
      description:
        "Let clients upload logos, service photos, team images, and other project files.",
      active: true,
      schema: { type: "file-upload" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  db.form_submissions = [];
  db.tickets = [];
  db.ticket_messages = [];
  db.conversations = [];
  db.conversation_participants = [];
  db.conversation_messages = [];
  db.deal_resources = [];
  db.deal_access_entries = [];
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
