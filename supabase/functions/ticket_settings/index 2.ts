import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { assertOrgAdministrator } from "../_shared/messagingSettings.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getTicketInboundSetup } from "../_shared/ticketInboundSetup.ts";
import {
  getOrgTransactionalEmailStatus,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import {
  loadOrgTicketWorkspaceSettings,
  mergeTicketWorkspaceSettings,
  saveOrgTicketWorkspaceSettings,
  type TicketWorkspaceSettings,
} from "../_shared/ticketWorkspaceSettings.ts";
import { sendTicketCsatEmail } from "../_shared/ticketInboundAutoReply.ts";

type TicketSettingsBody = {
  action?: "get" | "update" | "test_outbound";
  workspace?: Partial<TicketWorkspaceSettings>;
  inbox?: {
    id: number;
    display_name?: string | null;
    from_name?: string | null;
    is_active?: boolean;
    is_default?: boolean;
    auto_reply_enabled?: boolean;
    auto_reply_subject?: string | null;
    auto_reply_html?: string | null;
    auto_reply_text?: string | null;
    create_templates?: unknown;
    disabled_builtin_reply_template_ids?: string[];
    reply_signature_html?: string | null;
    reply_signature_text?: string | null;
    reply_templates?: unknown;
    email?: string;
  };
  create_inbox?: {
    email: string;
    display_name?: string | null;
    from_name?: string | null;
  };
  test_email?: string | null;
  ticket_id?: number | null;
};

const canViewTicketSettings = (member: Awaited<
  ReturnType<typeof getUserOrganizationMember>
>) =>
  Boolean(
    member &&
      (hasMemberCapability(member, "admin.settings.manage") ||
        hasMemberCapability(member, "support.tickets.manage") ||
        member.administrator === true),
  );

const canEditTicketSettings = (member: Awaited<
  ReturnType<typeof getUserOrganizationMember>
>) =>
  Boolean(
    member &&
      (hasMemberCapability(member, "admin.settings.manage") ||
        hasMemberCapability(member, "support.tickets.manage") ||
        member.administrator === true),
  );

const loadInboxes = async (orgId: number) => {
  const { data, error } = await supabaseAdmin
    .from("ticket_inboxes")
    .select(
      "id, email, display_name, from_name, is_active, is_default, auto_reply_enabled, auto_reply_subject, auto_reply_html, auto_reply_text, create_templates, disabled_builtin_reply_template_ids, reply_signature_html, reply_signature_text, reply_templates, sendgrid_hostname, sendgrid_forward_address, last_inbound_at",
    )
    .eq("org_id", orgId)
    .order("id", { ascending: true });

  if (error?.message?.includes("column")) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("ticket_inboxes")
      .select(
        "id, email, display_name, from_name, is_active, reply_signature_html, reply_signature_text, reply_templates, sendgrid_hostname, sendgrid_forward_address",
      )
      .eq("org_id", orgId)
      .order("id", { ascending: true });
    if (fallbackError) throw new Error(fallbackError.message);
    return (fallback ?? []).map((row) => ({
      ...row,
      is_default: false,
      auto_reply_enabled: true,
      auto_reply_subject: null,
      auto_reply_html: null,
      auto_reply_text: null,
      create_templates: [],
      disabled_builtin_reply_template_ids: [],
      last_inbound_at: null,
    }));
  }

  if (error) throw new Error(error.message);
  return data ?? [];
};

const buildHealth = async (orgId: number, inboxes: Awaited<ReturnType<typeof loadInboxes>>) => {
  const inbound = await getTicketInboundSetup(orgId);
  const emailStatus = await getOrgTransactionalEmailStatus(orgId);
  const latest = [...inboxes]
    .filter((row) => row.last_inbound_at)
    .sort((a, b) =>
      String(b.last_inbound_at).localeCompare(String(a.last_inbound_at))
    )[0];

  return {
    webhook_configured: inbound?.webhook_configured === true,
    outbound_configured: emailStatus.configured === true,
    last_inbound_at: latest?.last_inbound_at ?? null,
    last_inbound_inbox_email: latest?.email ?? null,
  };
};

const applyInboxUpdate = async (
  orgId: number,
  patch: NonNullable<TicketSettingsBody["inbox"]>,
) => {
  const update: Record<string, unknown> = {};
  if (patch.display_name !== undefined) update.display_name = patch.display_name;
  if (patch.from_name !== undefined) update.from_name = patch.from_name;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (patch.auto_reply_enabled !== undefined) {
    update.auto_reply_enabled = patch.auto_reply_enabled;
  }
  if (patch.auto_reply_subject !== undefined) {
    update.auto_reply_subject = patch.auto_reply_subject;
  }
  if (patch.auto_reply_html !== undefined) update.auto_reply_html = patch.auto_reply_html;
  if (patch.auto_reply_text !== undefined) update.auto_reply_text = patch.auto_reply_text;
  if (patch.create_templates !== undefined) {
    update.create_templates = patch.create_templates;
  }
  if (patch.disabled_builtin_reply_template_ids !== undefined) {
    update.disabled_builtin_reply_template_ids =
      patch.disabled_builtin_reply_template_ids;
  }
  if (patch.reply_signature_html !== undefined) {
    update.reply_signature_html = patch.reply_signature_html;
  }
  if (patch.reply_signature_text !== undefined) {
    update.reply_signature_text = patch.reply_signature_text;
  }
  if (patch.reply_templates !== undefined) {
    update.reply_templates = patch.reply_templates;
  }
  if (patch.email?.trim()) update.email = patch.email.trim().toLowerCase();

  if (patch.is_default === true) {
    await supabaseAdmin
      .from("ticket_inboxes")
      .update({ is_default: false })
      .eq("org_id", orgId);
    update.is_default = true;
  }

  const { data, error } = await supabaseAdmin
    .from("ticket_inboxes")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", patch.id)
    .select(
      "id, email, display_name, from_name, is_active, is_default, auto_reply_enabled, auto_reply_subject, auto_reply_html, auto_reply_text, create_templates, disabled_builtin_reply_template_ids, reply_signature_html, reply_signature_text, reply_templates, sendgrid_hostname, sendgrid_forward_address, last_inbound_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) return createErrorResponse(401, "Unauthorized");

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId || !canViewTicketSettings(member)) {
        return createErrorResponse(403, "Forbidden");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as TicketSettingsBody;
        const action = body.action ?? "get";

        if (action === "get") {
          const workspace = await loadOrgTicketWorkspaceSettings(orgId);
          const inboxes = await loadInboxes(orgId);
          const health = await buildHealth(orgId, inboxes);
          return new Response(
            JSON.stringify({ workspace, inboxes, health }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!canEditTicketSettings(member)) {
          return createErrorResponse(403, "Forbidden");
        }

        if (action === "update") {
          let workspace = await loadOrgTicketWorkspaceSettings(orgId);
          if (body.workspace && Object.keys(body.workspace).length > 0) {
            workspace = await saveOrgTicketWorkspaceSettings(orgId, body.workspace);
          }

          let updatedInbox = null;
          if (body.inbox?.id) {
            updatedInbox = await applyInboxUpdate(orgId, body.inbox);
          }

          if (body.create_inbox?.email?.trim()) {
            await assertOrgAdministrator(member);
            const email = body.create_inbox.email.trim().toLowerCase();
            const { error: insertError } = await supabaseAdmin
              .from("ticket_inboxes")
              .insert({
                org_id: orgId,
                email,
                display_name: body.create_inbox.display_name?.trim() || null,
                from_name: body.create_inbox.from_name?.trim() || null,
                is_active: true,
              });
            if (insertError) throw new Error(insertError.message);
          }

          const inboxes = await loadInboxes(orgId);
          const health = await buildHealth(orgId, inboxes);
          return new Response(
            JSON.stringify({
              workspace,
              inboxes,
              health,
              updated_inbox: updatedInbox,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (action === "test_outbound") {
          await assertOrgAdministrator(member);
          const testEmail = body.test_email?.trim();
          if (!testEmail) {
            return createErrorResponse(400, "test_email is required");
          }
          const inboxes = await loadInboxes(orgId);
          const inbox = inboxes.find((row) => row.is_default) ?? inboxes[0];
          if (!inbox?.email) {
            return createErrorResponse(400, "No ticket inbox configured");
          }
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .maybeSingle();
          await sendTransactionalEmail({
            orgId,
            orgName: org?.name?.trim() || "Support",
            to: testEmail,
            subject: "Ticket outbound test",
            textBody:
              "This is a test email from your ticket outbound (Twilio Email) settings.",
            htmlBody:
              "<p>This is a <strong>test email</strong> from your ticket outbound (Twilio Email) settings.</p>",
            fromEmail: inbox.email,
            fromName: inbox.from_name?.trim() || inbox.display_name?.trim() || "Support",
            replyTo: inbox.email,
          });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "send_csat") {
          const ticketId = Number(body.ticket_id);
          if (!ticketId) return createErrorResponse(400, "ticket_id required");
          const workspace = await loadOrgTicketWorkspaceSettings(orgId);
          if (!workspace.csat_enabled) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data: ticket, error: ticketError } = await supabaseAdmin
            .from("tickets")
            .select("id, requester_email, inbox_address, subject")
            .eq("id", ticketId)
            .eq("org_id", orgId)
            .maybeSingle();
          if (ticketError || !ticket) {
            return createErrorResponse(404, "Ticket not found");
          }
          const toEmail = ticket.requester_email?.trim();
          if (!toEmail) {
            return createErrorResponse(400, "Ticket has no requester email");
          }
          const inboxes = await loadInboxes(orgId);
          const inbox =
            inboxes.find(
              (row) =>
                row.email.toLowerCase() ===
                (ticket.inbox_address ?? "").toLowerCase(),
            ) ?? inboxes[0];
          if (!inbox?.email) {
            return createErrorResponse(400, "No inbox configured");
          }
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .maybeSingle();
          await sendTicketCsatEmail({
            orgId,
            orgName: org?.name?.trim() || "Support",
            ticketId,
            toEmail,
            fromEmail: inbox.email,
            fromName:
              inbox.from_name?.trim() ||
              inbox.display_name?.trim() ||
              "Support",
            subject: workspace.csat_subject,
            htmlBody: workspace.csat_body_html,
          });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return createErrorResponse(400, "Unknown action");
      } catch (error) {
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Ticket settings failed",
        );
      }
    });
  }),
);
