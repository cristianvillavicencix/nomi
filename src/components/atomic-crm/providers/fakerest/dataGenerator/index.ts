import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateOrganizationMembers } from "./organizationMembers";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import {
  LBS_SERVICE_ADDONS,
  LBS_SERVICE_PACKAGES,
} from "@/lbs/catalog/serviceCatalogSeed";
import { DEFAULT_PROPOSAL_TEMPLATES } from "@/lbs/proposals/document/proposalTemplateDefaults";
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
  db.proposal_payment_schedules = [];
  db.proposal_payment_installments = [];
  db.proposal_templates = DEFAULT_PROPOSAL_TEMPLATES.map((template, index) => ({
    id: index + 1,
    org_id: 1,
    name: template.name,
    slug: template.slug,
    category: template.category,
    content: template.content,
    is_system: true,
    active: true,
    sort_order: template.sort_order,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  db.service_packages = LBS_SERVICE_PACKAGES.map((pkg, index) => ({
    ...pkg,
    id: index + 1,
    org_id: 1,
  }));
  db.service_addons = LBS_SERVICE_ADDONS.map((addon, index) => ({
    ...addon,
    id: index + 1,
    org_id: 1,
  }));
  db.organization_contract_terms = [];
  db.contracts = [];
  db.public_proposal_tokens = [];
  db.deal_client_payments = [];
  db.maintenance_retainers = [];
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
