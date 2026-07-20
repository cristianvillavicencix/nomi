import { hasMemberCapability } from "../memberModulePermissions.ts";
import type {
  AssistantTool,
  ToolContext,
  ToolResult,
} from "./types.ts";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normalize to HH:MM:SS or null. */
const normalizeEventTime = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] != null ? Number(m[3]) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const deny = (capability: string): ToolResult => ({
  ok: false,
  error: `Missing permission: ${capability}`,
});

const requireAny = (ctx: ToolContext, caps: string[]): string | null => {
  if (!caps.length) return null;
  for (const cap of caps) {
    if (hasMemberCapability(ctx.member, cap)) return null;
  }
  return caps[0] ?? "required capability";
};

const maybeConfirm = (
  ctx: ToolContext,
  tool: string,
  input: Record<string, unknown>,
  summary: string,
): ToolResult | null => {
  if (ctx.confirmMode) return null;
  const pending = ctx.registerPendingAction({ tool, input, summary });
  return {
    ok: true,
    pending_action: pending,
    data: {
      status: "needs_confirmation",
      message: "Ask the user to confirm in the UI before this change is applied.",
      pending_action: pending,
    },
  };
};

const searchContacts: AssistantTool = {
  name: "search_contacts",
  description: "Search contacts by name, email, or phone. Returns up to 15 matches.",
  capabilities: ["crm.contacts.view"],
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search text" },
      limit: { type: "number", description: "Max results (default 10, max 15)" },
    },
    required: ["query"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.contacts.view"]);
    if (missing) return deny(missing);
    const query = str(input.query);
    if (!query) return { ok: false, error: "query is required" };
    const limit = Math.min(Math.max(num(input.limit) ?? 10, 1), 15);

    const { data, error } = await ctx.supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email_jsonb, phone_jsonb, company_id, status",
      )
      .eq("org_id", ctx.orgId)
      .or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%`,
      )
      .limit(limit);

    if (error) return { ok: false, error: error.message };

    let rows = data ?? [];
    if (rows.length < limit) {
      const { data: byEmail } = await ctx.supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, email_jsonb, phone_jsonb, company_id, status",
        )
        .eq("org_id", ctx.orgId)
        .filter("email_jsonb", "cs", JSON.stringify([{ email: query }]))
        .limit(limit);
      const seen = new Set(rows.map((r) => r.id));
      for (const row of byEmail ?? []) {
        if (!seen.has(row.id)) {
          rows.push(row);
          seen.add(row.id);
        }
      }
      rows = rows.slice(0, limit);
    }

    return {
      ok: true,
      data: {
        contacts: rows.map((c) => ({
          id: c.id,
          name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          status: c.status,
          company_id: c.company_id,
          emails: c.email_jsonb,
          phones: c.phone_jsonb,
        })),
      },
    };
  },
};

const searchCompanies: AssistantTool = {
  name: "search_companies",
  description: "Search companies/accounts by name.",
  capabilities: ["crm.companies.view"],
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.companies.view"]);
    if (missing) return deny(missing);
    const query = str(input.query);
    if (!query) return { ok: false, error: "query is required" };
    const limit = Math.min(Math.max(num(input.limit) ?? 10, 1), 15);

    const { data, error } = await ctx.supabase
      .from("companies")
      .select("id, name, sector, website, city, state_abbr")
      .eq("org_id", ctx.orgId)
      .ilike("name", `%${query}%`)
      .limit(limit);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { companies: data ?? [] } };
  },
};

const searchTickets: AssistantTool = {
  name: "search_tickets",
  description: "Search support tickets by subject, requester email, or id.",
  capabilities: ["support.tickets.view"],
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      status: { type: "string", description: "Optional status filter" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["support.tickets.view"]);
    if (missing) return deny(missing);
    const query = str(input.query);
    if (!query) return { ok: false, error: "query is required" };
    const limit = Math.min(Math.max(num(input.limit) ?? 10, 1), 15);
    const status = str(input.status);
    const asId = num(query);

    let q = ctx.supabase
      .from("tickets")
      .select(
        "id, subject, status, priority, requester_email, requester_name, company_id, contact_id, updated_at",
      )
      .eq("org_id", ctx.orgId)
      .is("merged_into_ticket_id", null)
      .limit(limit);

    if (status) q = q.eq("status", status);

    if (asId != null) {
      q = q.eq("id", asId);
    } else {
      q = q.or(
        `subject.ilike.%${query}%,requester_email.ilike.%${query}%,requester_name.ilike.%${query}%`,
      );
    }

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { tickets: data ?? [] } };
  },
};

const getTicketSummary: AssistantTool = {
  name: "get_ticket_summary",
  description: "Get one ticket with recent messages (truncated bodies).",
  capabilities: ["support.tickets.view"],
  input_schema: {
    type: "object",
    properties: {
      ticket_id: { type: "number" },
    },
    required: ["ticket_id"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["support.tickets.view"]);
    if (missing) return deny(missing);
    const ticketId = num(input.ticket_id);
    if (ticketId == null) return { ok: false, error: "ticket_id is required" };

    const { data: ticket, error } = await ctx.supabase
      .from("tickets")
      .select(
        "id, subject, status, priority, requester_email, requester_name, company_id, contact_id, deal_id, created_at, updated_at",
      )
      .eq("org_id", ctx.orgId)
      .eq("id", ticketId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!ticket) return { ok: false, error: "Ticket not found" };

    const { data: messages } = await ctx.supabase
      .from("ticket_messages")
      .select("id, direction, from_name, from_email, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(8);

    return {
      ok: true,
      data: {
        ticket,
        recent_messages: (messages ?? []).map((m) => ({
          ...m,
          body: String(m.body ?? "").slice(0, 400),
        })),
      },
    };
  },
};

const searchDeals: AssistantTool = {
  name: "search_deals",
  description: "Search projects/deals by name or stage.",
  capabilities: ["crm.pipeline.view"],
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      stage: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.pipeline.view"]);
    if (missing) return deny(missing);
    const query = str(input.query);
    if (!query) return { ok: false, error: "query is required" };
    const limit = Math.min(Math.max(num(input.limit) ?? 10, 1), 15);
    const stage = str(input.stage);
    const canViewAmounts = hasMemberCapability(ctx.member, "view_amounts.show");

    let q = ctx.supabase
      .from("deals")
      .select(
        "id, name, stage, category, company_id, amount, expected_closing_date, updated_at",
      )
      .eq("org_id", ctx.orgId)
      .is("archived_at", null)
      .ilike("name", `%${query}%`)
      .limit(limit);

    if (stage) q = q.eq("stage", stage);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      data: {
        deals: (data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          category: d.category,
          company_id: d.company_id,
          expected_closing_date: d.expected_closing_date,
          updated_at: d.updated_at,
          amount: canViewAmounts ? d.amount : undefined,
          amount_hidden: !canViewAmounts,
        })),
      },
    };
  },
};

const listCalendarEvents: AssistantTool = {
  name: "list_calendar_events",
  description: "List calendar events in a date range (default: today ± 7 days).",
  capabilities: ["calendar.view", "crm.tasks.view"],
  input_schema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "YYYY-MM-DD" },
      end_date: { type: "string", description: "YYYY-MM-DD" },
      limit: { type: "number" },
    },
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["calendar.view", "crm.tasks.view"]);
    if (missing) return deny(missing);

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start =
      str(input.start_date) ||
      fmt(new Date(today.getTime() - 7 * 86400000));
    const end =
      str(input.end_date) ||
      fmt(new Date(today.getTime() + 7 * 86400000));
    const limit = Math.min(Math.max(num(input.limit) ?? 30, 1), 50);

    const { data, error } = await ctx.supabase
      .from("calendar_events")
      .select(
        "id, title, event_date, description, contact_id, company_id, deal_id, completed_at",
      )
      .eq("org_id", ctx.orgId)
      .gte("event_date", start)
      .lte("event_date", end)
      .order("event_date", { ascending: true })
      .limit(limit);

    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: { start_date: start, end_date: end, events: data ?? [] },
    };
  },
};

const searchInvoices: AssistantTool = {
  name: "search_invoices",
  description:
    "List or search client invoices. Use status=draft for draft invoices (no query needed). Also supports sent, paid, overdue, void. Optional query matches invoice_number.",
  capabilities: ["proposals.view"],
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Invoice number fragment. Optional when status is set (e.g. draft).",
      },
      status: {
        type: "string",
        description: "draft | sent | paid | overdue | void | open (sent+overdue)",
      },
      company_id: { type: "number" },
      limit: { type: "number" },
    },
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["proposals.view"]);
    if (missing) return deny(missing);
    const canViewAmounts = hasMemberCapability(ctx.member, "view_amounts.show");
    const limit = Math.min(Math.max(num(input.limit) ?? 15, 1), 30);
    let query = str(input.query);
    let status = str(input.status).toLowerCase();
    const companyId = num(input.company_id);

    // If the user typed a status word as the query, treat it as status.
    const statusAlias = query.toLowerCase();
    if (
      !status &&
      ["draft", "sent", "paid", "overdue", "void", "open"].includes(statusAlias)
    ) {
      status = statusAlias;
      query = "";
    }

    let q = ctx.supabase
      .from("client_invoices")
      .select(
        "id, invoice_number, status, company_id, contact_id, amount, currency, due_date, created_at",
      )
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "open") {
      q = q.in("status", ["sent", "overdue"]);
    } else if (status) {
      q = q.eq("status", status);
    }
    if (companyId != null) q = q.eq("company_id", companyId);
    if (query) q = q.ilike("invoice_number", `%${query}%`);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      data: {
        filter: { query: query || null, status: status || null, company_id: companyId },
        count: (data ?? []).length,
        invoices: (data ?? []).map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          status: inv.status,
          company_id: inv.company_id,
          contact_id: inv.contact_id,
          due_date: inv.due_date,
          currency: inv.currency,
          amount: canViewAmounts ? inv.amount : undefined,
          amount_hidden: !canViewAmounts,
        })),
      },
    };
  },
};

const navigateTo: AssistantTool = {
  name: "navigate_to",
  description:
    "Ask the client app to open an in-app path (e.g. /tickets/77/show, /billing/invoices/new?company_id=12, /companies/5/show).",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute app path starting with /",
      },
    },
    required: ["path"],
  },
  execute: async (_ctx, input) => {
    let path = str(input.path);
    if (!path.startsWith("/")) {
      return { ok: false, error: "path must start with /" };
    }
    if (path.includes("://") || path.includes("..")) {
      return { ok: false, error: "Invalid path" };
    }
    // Normalize common shortcuts
    const ticketMatch = path.match(/^\/tickets\/(\d+)\/?$/);
    if (ticketMatch) path = `/tickets/${ticketMatch[1]}/show`;
    const contactMatch = path.match(/^\/contacts\/(\d+)\/?$/);
    if (contactMatch) path = `/contacts/${contactMatch[1]}/show`;

    return {
      ok: true,
      navigate: path,
      data: { navigate: path, message: `Opening ${path}` },
    };
  },
};

const createTask: AssistantTool = {
  name: "create_task",
  description: "Create a task for a contact (requires UI confirmation).",
  capabilities: ["crm.tasks.create"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      contact_id: { type: "number" },
      text: { type: "string" },
      type: { type: "string" },
      due_date: { type: "string", description: "ISO datetime" },
    },
    required: ["contact_id", "text", "due_date"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.tasks.create"]);
    if (missing) return deny(missing);
    const contactId = num(input.contact_id);
    const text = str(input.text);
    const dueDate = str(input.due_date);
    if (contactId == null || !text || !dueDate) {
      return { ok: false, error: "contact_id, text, and due_date are required" };
    }

    const gated = maybeConfirm(
      ctx,
      "create_task",
      input,
      `Create task “${text.slice(0, 80)}” for contact #${contactId}`,
    );
    if (gated) return gated;

    const { data, error } = await ctx.supabase
      .from("tasks")
      .insert({
        contact_id: contactId,
        text,
        type: str(input.type) || "None",
        due_date: dueDate,
        sales_id: ctx.member.id,
      })
      .select("id, contact_id, text, type, due_date")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { task: data } };
  },
};

const scheduleMeeting: AssistantTool = {
  name: "schedule_meeting",
  description:
    "Create a calendar meeting (requires UI confirmation). Prefer plan_meeting when the contact may need creating.",
  capabilities: ["calendar.manage", "meetings.manage"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      event_date: { type: "string", description: "YYYY-MM-DD" },
      event_time: {
        type: "string",
        description: "HH:MM or HH:MM:SS (24h). Optional.",
      },
      description: { type: "string" },
      contact_id: { type: "number" },
      company_id: { type: "number" },
      deal_id: { type: "number" },
    },
    required: ["title", "event_date"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["calendar.manage", "meetings.manage"]);
    if (missing) return deny(missing);
    const title = str(input.title);
    const eventDate = str(input.event_date);
    if (!title || !eventDate) {
      return { ok: false, error: "title and event_date are required" };
    }
    const eventTime = normalizeEventTime(str(input.event_time));

    const timeLabel = eventTime ? ` at ${eventTime.slice(0, 5)}` : "";
    const gated = maybeConfirm(
      ctx,
      "schedule_meeting",
      { ...input, event_time: eventTime },
      `Schedule “${title}” on ${eventDate}${timeLabel}`,
    );
    if (gated) return gated;

    const { data, error } = await ctx.supabase
      .from("calendar_events")
      .insert({
        org_id: ctx.orgId,
        title,
        event_date: eventDate,
        event_time: eventTime,
        description: str(input.description) || null,
        contact_id: num(input.contact_id),
        company_id: num(input.company_id),
        deal_id: num(input.deal_id),
        organization_member_id: ctx.member.id,
      })
      .select("id, title, event_date, event_time, contact_id, company_id, deal_id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { event: data } };
  },
};

const addInternalNote: AssistantTool = {
  name: "add_internal_note",
  description: "Add an internal note on a ticket (requires UI confirmation).",
  capabilities: ["support.tickets.manage"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      ticket_id: { type: "number" },
      body: { type: "string" },
    },
    required: ["ticket_id", "body"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["support.tickets.manage"]);
    if (missing) return deny(missing);
    const ticketId = num(input.ticket_id);
    const body = str(input.body);
    if (ticketId == null || !body) {
      return { ok: false, error: "ticket_id and body are required" };
    }

    const gated = maybeConfirm(
      ctx,
      "add_internal_note",
      input,
      `Add internal note on ticket #${ticketId}`,
    );
    if (gated) return gated;

    const { data: ticket, error: ticketError } = await ctx.supabase
      .from("tickets")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("id", ticketId)
      .maybeSingle();
    if (ticketError) return { ok: false, error: ticketError.message };
    if (!ticket) return { ok: false, error: "Ticket not found" };

    const memberName = [ctx.member.first_name, ctx.member.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    const { data, error } = await ctx.supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_member_id: ctx.member.id,
        body,
        direction: "internal",
        from_name: memberName || ctx.member.email || "Team",
      })
      .select("id, ticket_id, body, direction, created_at")
      .single();

    if (error) return { ok: false, error: error.message };

    await ctx.supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("org_id", ctx.orgId);

    return { ok: true, data: { message: data } };
  },
};

const draftTicketReply: AssistantTool = {
  name: "draft_ticket_reply",
  description:
    "Draft a customer-facing ticket reply text. Does not send email.",
  capabilities: ["support.tickets.manage"],
  input_schema: {
    type: "object",
    properties: {
      ticket_id: { type: "number" },
      intent: {
        type: "string",
        description: "What the reply should accomplish",
      },
      tone: { type: "string", description: "e.g. friendly, formal" },
    },
    required: ["ticket_id", "intent"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["support.tickets.manage"]);
    if (missing) return deny(missing);
    const ticketId = num(input.ticket_id);
    const intent = str(input.intent);
    if (ticketId == null || !intent) {
      return { ok: false, error: "ticket_id and intent are required" };
    }

    const { data: ticket } = await ctx.supabase
      .from("tickets")
      .select("id, subject, requester_name, status")
      .eq("org_id", ctx.orgId)
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return { ok: false, error: "Ticket not found" };

    const tone = str(input.tone) || "friendly professional";
    const name = ticket.requester_name?.trim() || "there";
    const draft = `Hi ${name},\n\nThanks for reaching out about “${ticket.subject}”.\n\n${intent}\n\nPlease let us know if you have any questions.\n\nBest regards`;

    return {
      ok: true,
      data: {
        ticket_id: ticketId,
        tone,
        draft,
        note: "Draft only — not sent. User must reply from the ticket UI.",
      },
    };
  },
};

const updateTicketStatus: AssistantTool = {
  name: "update_ticket_status",
  description: "Update a ticket status (requires UI confirmation).",
  capabilities: ["support.tickets.manage"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      ticket_id: { type: "number" },
      status: { type: "string" },
    },
    required: ["ticket_id", "status"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["support.tickets.manage"]);
    if (missing) return deny(missing);
    const ticketId = num(input.ticket_id);
    const status = str(input.status);
    if (ticketId == null || !status) {
      return { ok: false, error: "ticket_id and status are required" };
    }

    const gated = maybeConfirm(
      ctx,
      "update_ticket_status",
      input,
      `Set ticket #${ticketId} status to “${status}”`,
    );
    if (gated) return gated;

    const { data, error } = await ctx.supabase
      .from("tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("org_id", ctx.orgId)
      .select("id, subject, status")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Ticket not found" };
    return { ok: true, data: { ticket: data } };
  },
};

const createContactQuick: AssistantTool = {
  name: "create_contact_quick",
  description: "Quick-create a contact (requires UI confirmation).",
  capabilities: ["crm.contacts.create"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      first_name: { type: "string" },
      last_name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      company_id: { type: "number" },
    },
    required: ["first_name"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.contacts.create"]);
    if (missing) return deny(missing);
    const firstName = str(input.first_name);
    if (!firstName) return { ok: false, error: "first_name is required" };
    const lastName = str(input.last_name);
    const email = str(input.email);
    const phone = str(input.phone);

    const gated = maybeConfirm(
      ctx,
      "create_contact_quick",
      input,
      `Create contact ${firstName} ${lastName}`.trim(),
    );
    if (gated) return gated;

    const row: Record<string, unknown> = {
      org_id: ctx.orgId,
      first_name: firstName,
      last_name: lastName || "",
      company_id: num(input.company_id),
      sales_id: ctx.member.id,
    };
    if (email) row.email_jsonb = [{ email, type: "Work" }];
    if (phone) row.phone_jsonb = [{ number: phone, type: "Work" }];

    const { data, error } = await ctx.supabase
      .from("contacts")
      .insert(row)
      .select("id, first_name, last_name, company_id")
      .single();

    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: { contact: data },
      navigate: data?.id ? `/contacts/${data.id}/show` : undefined,
    };
  },
};

const getDealSummary: AssistantTool = {
  name: "get_deal_summary",
  description: "Summarize one deal/project by id.",
  capabilities: ["crm.pipeline.view"],
  input_schema: {
    type: "object",
    properties: { deal_id: { type: "number" } },
    required: ["deal_id"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.pipeline.view"]);
    if (missing) return deny(missing);
    const dealId = num(input.deal_id);
    if (dealId == null) return { ok: false, error: "deal_id is required" };
    const canViewAmounts = hasMemberCapability(ctx.member, "view_amounts.show");

    const { data: deal, error } = await ctx.supabase
      .from("deals")
      .select(
        "id, name, stage, category, description, company_id, contact_ids, amount, expected_closing_date, created_at, updated_at",
      )
      .eq("org_id", ctx.orgId)
      .eq("id", dealId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!deal) return { ok: false, error: "Deal not found" };

    return {
      ok: true,
      data: {
        deal: {
          ...deal,
          amount: canViewAmounts ? deal.amount : undefined,
          amount_hidden: !canViewAmounts,
        },
      },
    };
  },
};

const getInvoice: AssistantTool = {
  name: "get_invoice",
  description: "Get one client invoice by id.",
  capabilities: ["proposals.view"],
  input_schema: {
    type: "object",
    properties: { invoice_id: { type: "number" } },
    required: ["invoice_id"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["proposals.view"]);
    if (missing) return deny(missing);
    const invoiceId = num(input.invoice_id);
    if (invoiceId == null) return { ok: false, error: "invoice_id is required" };
    const canViewAmounts = hasMemberCapability(ctx.member, "view_amounts.show");

    const { data, error } = await ctx.supabase
      .from("client_invoices")
      .select(
        "id, invoice_number, status, company_id, contact_id, amount, amount_paid, currency, due_date, issue_date, notes",
      )
      .eq("org_id", ctx.orgId)
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Invoice not found" };

    return {
      ok: true,
      data: {
        invoice: {
          ...data,
          amount: canViewAmounts ? data.amount : undefined,
          amount_paid: canViewAmounts ? data.amount_paid : undefined,
          amount_hidden: !canViewAmounts,
          notes: data.notes ? String(data.notes).slice(0, 500) : null,
        },
      },
    };
  },
};

const draftSms: AssistantTool = {
  name: "draft_sms",
  description:
    "Draft an SMS body for a contact. Does not send; requires UI confirm to mark as ready.",
  capabilities: ["messaging.send"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      contact_id: { type: "number" },
      body: { type: "string" },
    },
    required: ["contact_id", "body"],
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["messaging.send"]);
    if (missing) return deny(missing);
    const contactId = num(input.contact_id);
    const body = str(input.body);
    if (contactId == null || !body) {
      return { ok: false, error: "contact_id and body are required" };
    }
    if (body.length > 480) {
      return { ok: false, error: "SMS body must be 480 characters or fewer" };
    }

    const gated = maybeConfirm(
      ctx,
      "draft_sms",
      input,
      `Prepare SMS draft for contact #${contactId}`,
    );
    if (gated) return gated;

    // Confirm only stores the draft for the user — never auto-sends.
    return {
      ok: true,
      data: {
        status: "draft_ready",
        contact_id: contactId,
        body,
        note: "Draft confirmed. Open Messages to send manually — assistant never auto-sends SMS.",
      },
      navigate: `/messages?contact_id=${contactId}`,
    };
  },
};

const listCampaigns: AssistantTool = {
  name: "list_campaigns",
  description: "List recent marketing SMS campaigns (read-only).",
  capabilities: ["marketing.view"],
  input_schema: {
    type: "object",
    properties: { limit: { type: "number" } },
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["marketing.view"]);
    if (missing) return deny(missing);
    const limit = Math.min(Math.max(num(input.limit) ?? 10, 1), 20);

    const { data, error } = await ctx.supabase
      .from("sms_campaigns")
      .select("id, name, status, scheduled_at, created_at, recipient_count, sent_count")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { campaigns: data ?? [] } };
  },
};

/**
 * One-shot: search/create contact + schedule meeting as a single Confirm batch.
 */
const planMeeting: AssistantTool = {
  name: "plan_meeting",
  description:
    "Plan a meeting with a person by name or contact_id. If the contact is missing and create_if_missing is true, packages create-contact + schedule into one UI Confirm. Prefer this for natural requests like “meeting Monday 11am with Salvador”.",
  capabilities: ["calendar.manage", "meetings.manage", "crm.contacts.create"],
  requiresConfirm: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      event_date: { type: "string", description: "YYYY-MM-DD" },
      event_time: {
        type: "string",
        description: "HH:MM 24h (e.g. 11:00)",
      },
      description: { type: "string" },
      contact_id: { type: "number" },
      contact_first_name: { type: "string" },
      contact_last_name: { type: "string" },
      contact_email: { type: "string" },
      contact_phone: { type: "string" },
      create_if_missing: {
        type: "boolean",
        description: "Create the contact when not found (default true)",
      },
    },
    required: ["title", "event_date"],
  },
  execute: async (ctx, input) => {
    const calMissing = requireAny(ctx, ["calendar.manage", "meetings.manage"]);
    if (calMissing) return deny(calMissing);

    const title = str(input.title);
    const eventDate = str(input.event_date);
    if (!title || !eventDate) {
      return { ok: false, error: "title and event_date are required" };
    }
    const eventTime = normalizeEventTime(str(input.event_time));
    const timeLabel = eventTime ? ` at ${eventTime.slice(0, 5)}` : "";
    const createIfMissing = input.create_if_missing !== false;

    let contactId = num(input.contact_id);
    const firstName = str(input.contact_first_name);
    const lastName = str(input.contact_last_name);
    const email = str(input.contact_email);
    const phone = str(input.contact_phone);

    if (contactId == null && firstName) {
      const { data: matches } = await ctx.supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("org_id", ctx.orgId)
        .ilike("first_name", firstName)
        .limit(8);

      const filtered = (matches ?? []).filter((c) => {
        if (!lastName) return true;
        return String(c.last_name ?? "")
          .toLowerCase()
          .includes(lastName.toLowerCase());
      });

      if (filtered.length === 1) {
        contactId = Number(filtered[0].id);
      } else if (filtered.length > 1) {
        return {
          ok: true,
          data: {
            status: "ambiguous_contact",
            contacts: filtered.map((c) => ({
              id: c.id,
              name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
            })),
            message:
              "Several contacts match. Ask the user which id to use, then call plan_meeting again with contact_id.",
          },
        };
      }
    }

    // Confirm mode: execute create (if needed) then schedule immediately
    if (ctx.confirmMode) {
      if (contactId == null && createIfMissing && firstName) {
        const createMissing = requireAny(ctx, ["crm.contacts.create"]);
        if (createMissing) return deny(createMissing);
        const row: Record<string, unknown> = {
          org_id: ctx.orgId,
          first_name: firstName,
          last_name: lastName || "",
          sales_id: ctx.member.id,
        };
        if (email) row.email_jsonb = [{ email, type: "Work" }];
        if (phone) row.phone_jsonb = [{ number: phone, type: "Work" }];
        const { data: created, error: createError } = await ctx.supabase
          .from("contacts")
          .insert(row)
          .select("id, first_name, last_name")
          .single();
        if (createError || !created) {
          return {
            ok: false,
            error: createError?.message ?? "Could not create contact",
          };
        }
        contactId = Number(created.id);
      }

      if (contactId == null) {
        return {
          ok: false,
          error: "contact_id or contact_first_name is required",
        };
      }

      const { data: event, error } = await ctx.supabase
        .from("calendar_events")
        .insert({
          org_id: ctx.orgId,
          title,
          event_date: eventDate,
          event_time: eventTime,
          description: str(input.description) || null,
          contact_id: contactId,
          organization_member_id: ctx.member.id,
        })
        .select("id, title, event_date, event_time, contact_id")
        .single();

      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        data: { event, contact_id: contactId },
        navigate: `/calendar`,
      };
    }

    // Already have contact → single schedule confirm
    if (contactId != null) {
      const pending = ctx.registerPendingAction({
        tool: "schedule_meeting",
        input: {
          title,
          event_date: eventDate,
          event_time: eventTime,
          description: str(input.description) || null,
          contact_id: contactId,
        },
        summary: `Schedule “${title}” on ${eventDate}${timeLabel} (contact #${contactId})`,
      });
      return {
        ok: true,
        pending_action: pending,
        data: {
          status: "needs_confirmation",
          pending_action: pending,
        },
      };
    }

    if (!createIfMissing || !firstName) {
      return {
        ok: false,
        error:
          "No matching contact. Provide contact_id, or contact_first_name with create_if_missing true.",
      };
    }

    const createMissing = requireAny(ctx, ["crm.contacts.create"]);
    if (createMissing) return deny(createMissing);

    const contactLabel = `${firstName} ${lastName}`.trim();
    const pending = ctx.registerPendingAction({
      tool: "__batch__",
      input: {},
      summary: `Create ${contactLabel} and schedule “${title}” on ${eventDate}${timeLabel}`,
      steps: [
        {
          tool: "create_contact_quick",
          input: {
            first_name: firstName,
            last_name: lastName || "",
            email: email || undefined,
            phone: phone || undefined,
          },
          summary: `Create contact ${contactLabel}`,
          bind_next: { contact_id: "contact.id" },
        },
        {
          tool: "schedule_meeting",
          input: {
            title,
            event_date: eventDate,
            event_time: eventTime,
            description: str(input.description) || null,
          },
          summary: `Schedule “${title}” on ${eventDate}${timeLabel}`,
        },
      ],
    });

    return {
      ok: true,
      pending_action: pending,
      data: {
        status: "needs_confirmation",
        pending_action: pending,
        message:
          "One Confirm creates the contact (if needed) and schedules the meeting.",
      },
    };
  },
};

const dayBoundsUtc = (isoDate: string) => {
  const start = `${isoDate}T00:00:00.000Z`;
  const endDate = new Date(`${isoDate}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString() };
};

const listTasks: AssistantTool = {
  name: "list_tasks",
  description:
    "List CRM tasks (Work). Use for “my tasks today”, “team tasks”, overdue, or upcoming. Prefer this over calendar for to-dos.",
  capabilities: ["crm.tasks.view"],
  input_schema: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        description: "mine (default) | team (all open tasks in the org)",
      },
      due: {
        type: "string",
        description: "today | overdue | upcoming | all",
      },
      include_done: {
        type: "boolean",
        description: "Include completed tasks (default false)",
      },
      limit: { type: "number" },
    },
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.tasks.view"]);
    if (missing) return deny(missing);

    const scope = (str(input.scope) || "mine").toLowerCase();
    const due = (str(input.due) || "today").toLowerCase();
    const includeDone = Boolean(input.include_done);
    const limit = Math.min(Math.max(num(input.limit) ?? 25, 1), 50);
    const memberId = Number(ctx.member.id);
    const today = new Date().toISOString().slice(0, 10);
    const { start: todayStart, end: tomorrowStart } = dayBoundsUtc(today);

    let q = ctx.supabase
      .from("tasks")
      .select(
        "id, text, type, due_date, done_date, contact_id, deal_id, organization_member_id, assignee_person_ids, priority",
      )
      .eq("org_id", ctx.orgId)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (!includeDone) {
      q = q.is("done_date", null);
    }

    if (due === "today") {
      q = q.gte("due_date", todayStart).lt("due_date", tomorrowStart);
    } else if (due === "overdue") {
      q = q.lt("due_date", todayStart);
    } else if (due === "upcoming") {
      q = q.gte("due_date", tomorrowStart);
    }

    if (scope !== "team" && Number.isFinite(memberId)) {
      q = q.or(
        `organization_member_id.eq.${memberId},assignee_person_ids.cs.{${memberId}}`,
      );
    }

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      data: {
        scope: scope === "team" ? "team" : "mine",
        due,
        as_of_date: today,
        count: (data ?? []).length,
        tasks: (data ?? []).map((task) => ({
          id: task.id,
          text: task.text,
          type: task.type,
          due_date: task.due_date,
          done: Boolean(task.done_date),
          contact_id: task.contact_id,
          deal_id: task.deal_id,
          organization_member_id: task.organization_member_id,
          priority: task.priority ?? "normal",
        })),
      },
    };
  },
};

const orgMonthlySummary: AssistantTool = {
  name: "org_monthly_summary",
  description:
    "Monthly CRM snapshot: tickets, invoices, deals, tasks. Use for “resumen mensual”, month overview, or KPIs.",
  capabilities: [
    "crm.contacts.view",
    "crm.companies.view",
    "support.tickets.view",
    "crm.pipeline.view",
    "crm.tasks.view",
    "proposals.view",
  ],
  input_schema: {
    type: "object",
    properties: {
      year_month: {
        type: "string",
        description: "YYYY-MM (default: current UTC month)",
      },
    },
  },
  execute: async (ctx, input) => {
    const now = new Date();
    const raw = str(input.year_month);
    const yearMonth = /^\d{4}-\d{2}$/.test(raw)
      ? raw
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = yearMonth.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const monthEnd = new Date(Date.UTC(y, m, 1)).toISOString();

    const canTickets = hasMemberCapability(ctx.member, "support.tickets.view");
    const canPipeline = hasMemberCapability(ctx.member, "crm.pipeline.view");
    const canTasks = hasMemberCapability(ctx.member, "crm.tasks.view");
    const canInvoices = hasMemberCapability(ctx.member, "proposals.view");
    const canAmounts = hasMemberCapability(ctx.member, "view_amounts.show");

    const countExact = async (
      table: string,
      // deno-lint-ignore no-explicit-any
      patch: (q: any) => any,
    ) => {
      // deno-lint-ignore no-explicit-any
      let q: any = ctx.supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("org_id", ctx.orgId);
      q = patch(q);
      const { count, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      return count ?? 0;
    };

    const summary: Record<string, unknown> = {
      year_month: yearMonth,
      period: { start: monthStart, end: monthEnd },
    };

    try {
      if (canTickets) {
        summary.tickets = {
          created_this_month: await countExact("tickets", (q) =>
            q.gte("created_at", monthStart).lt("created_at", monthEnd),
          ),
          currently_openish: await countExact("tickets", (q) =>
            q
              .is("merged_into_ticket_id", null)
              .in("status", ["new", "open", "pending", "waiting"]),
          ),
        };
      } else {
        summary.tickets = { skipped: "missing support.tickets.view" };
      }

      if (canInvoices) {
        let amountCreated: number | undefined;
        if (canAmounts) {
          const { data: rows, error } = await ctx.supabase
            .from("client_invoices")
            .select("amount")
            .eq("org_id", ctx.orgId)
            .gte("created_at", monthStart)
            .lt("created_at", monthEnd);
          if (error) throw new Error(error.message);
          amountCreated = (rows ?? []).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0,
          );
        }

        summary.invoices = {
          created_this_month: await countExact("client_invoices", (q) =>
            q.gte("created_at", monthStart).lt("created_at", monthEnd),
          ),
          draft_open: await countExact("client_invoices", (q) =>
            q.eq("status", "draft"),
          ),
          sent_open: await countExact("client_invoices", (q) =>
            q.eq("status", "sent"),
          ),
          paid_created_this_month: await countExact("client_invoices", (q) =>
            q
              .eq("status", "paid")
              .gte("created_at", monthStart)
              .lt("created_at", monthEnd),
          ),
          amount_created_this_month: amountCreated,
          amount_hidden: !canAmounts,
        };
      } else {
        summary.invoices = { skipped: "missing proposals.view" };
      }

      if (canPipeline) {
        summary.deals = {
          created_this_month: await countExact("deals", (q) =>
            q.gte("created_at", monthStart).lt("created_at", monthEnd),
          ),
          openish: await countExact("deals", (q) =>
            q.not("stage", "in", '("won","lost")'),
          ),
        };
      } else {
        summary.deals = { skipped: "missing crm.pipeline.view" };
      }

      if (canTasks) {
        summary.tasks = {
          due_this_month: await countExact("tasks", (q) =>
            q.gte("due_date", monthStart).lt("due_date", monthEnd),
          ),
          completed_this_month: await countExact("tasks", (q) =>
            q
              .not("done_date", "is", null)
              .gte("done_date", monthStart)
              .lt("done_date", monthEnd),
          ),
          currently_open: await countExact("tasks", (q) =>
            q.is("done_date", null),
          ),
        };
      } else {
        summary.tasks = { skipped: "missing crm.tasks.view" };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Summary failed",
      };
    }

    return { ok: true, data: summary };
  },
};

const getCompanySummary: AssistantTool = {
  name: "get_company_summary",
  description:
    "Summarize one company/client by id or name: contacts, open deals, tickets, and recent invoices. Use for random questions about a client.",
  capabilities: ["crm.companies.view"],
  input_schema: {
    type: "object",
    properties: {
      company_id: { type: "number" },
      query: {
        type: "string",
        description: "Company name when company_id is unknown",
      },
    },
  },
  execute: async (ctx, input) => {
    const missing = requireAny(ctx, ["crm.companies.view"]);
    if (missing) return deny(missing);
    const canViewAmounts = hasMemberCapability(ctx.member, "view_amounts.show");
    let companyId = num(input.company_id);
    const query = str(input.query);

    if (companyId == null && query) {
      const { data: matches, error: searchError } = await ctx.supabase
        .from("companies")
        .select("id, name, sector, website, city, state_abbr, phone_number")
        .eq("org_id", ctx.orgId)
        .ilike("name", `%${query}%`)
        .limit(5);
      if (searchError) return { ok: false, error: searchError.message };
      if (!matches?.length) {
        return { ok: true, data: { found: false, query, companies: [] } };
      }
      if (matches.length > 1) {
        return {
          ok: true,
          data: {
            found: false,
            ambiguous: true,
            query,
            companies: matches,
          },
        };
      }
      companyId = Number(matches[0].id);
    }

    if (companyId == null) {
      return { ok: false, error: "company_id or query is required" };
    }

    const { data: company, error: companyError } = await ctx.supabase
      .from("companies")
      .select(
        "id, name, sector, website, city, state_abbr, phone_number, primary_contact_id",
      )
      .eq("org_id", ctx.orgId)
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) return { ok: false, error: companyError.message };
    if (!company) return { ok: false, error: "Company not found" };

    const [contactsRes, dealsRes, ticketsRes, invoicesRes] = await Promise.all([
      ctx.supabase
        .from("contacts")
        .select("id, first_name, last_name, status")
        .eq("org_id", ctx.orgId)
        .eq("company_id", companyId)
        .limit(20),
      ctx.supabase
        .from("deals")
        .select("id, name, stage, amount, updated_at")
        .eq("org_id", ctx.orgId)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(10),
      ctx.supabase
        .from("tickets")
        .select("id, subject, status, priority, updated_at")
        .eq("org_id", ctx.orgId)
        .eq("company_id", companyId)
        .is("merged_into_ticket_id", null)
        .order("updated_at", { ascending: false })
        .limit(10),
      ctx.supabase
        .from("client_invoices")
        .select(
          "id, invoice_number, status, amount, currency, due_date, created_at",
        )
        .eq("org_id", ctx.orgId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      ok: true,
      data: {
        found: true,
        company,
        contacts: contactsRes.data ?? [],
        deals: (dealsRes.data ?? []).map((deal) => ({
          ...deal,
          amount: canViewAmounts ? deal.amount : undefined,
          amount_hidden: !canViewAmounts,
        })),
        tickets: ticketsRes.data ?? [],
        invoices: (invoicesRes.data ?? []).map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          status: inv.status,
          due_date: inv.due_date,
          currency: inv.currency,
          amount: canViewAmounts ? inv.amount : undefined,
          amount_hidden: !canViewAmounts,
        })),
        create_invoice_path: `/billing/invoices/new?company_id=${companyId}`,
        company_show_path: `/companies/${companyId}/show`,
      },
    };
  },
};

export const ASSISTANT_TOOLS: AssistantTool[] = [
  searchContacts,
  searchCompanies,
  getCompanySummary,
  searchTickets,
  getTicketSummary,
  searchDeals,
  listCalendarEvents,
  searchInvoices,
  listTasks,
  orgMonthlySummary,
  navigateTo,
  createTask,
  scheduleMeeting,
  planMeeting,
  addInternalNote,
  draftTicketReply,
  updateTicketStatus,
  createContactQuick,
  getDealSummary,
  getInvoice,
  draftSms,
  listCampaigns,
];

export const getToolByName = (name: string) =>
  ASSISTANT_TOOLS.find((t) => t.name === name);

export const toAnthropicToolDefs = () =>
  ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
