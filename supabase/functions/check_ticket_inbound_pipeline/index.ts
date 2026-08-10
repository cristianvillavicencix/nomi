import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedClientBillingCron } from "../_shared/clientProposalBilling.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getPrimaryAdminEmail } from "../_shared/billingAccess.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import {
  loadOrgTicketWorkspaceSettings,
} from "../_shared/ticketWorkspaceSettings.ts";
import { isPipelineStale } from "../_shared/ticketInboundFailures.ts";

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const { data: inboxes, error } = await supabaseAdmin
        .from("ticket_inboxes")
        .select(
          "id, org_id, email, last_inbound_at, pipeline_stale_notified_at, is_active",
        )
        .eq("is_active", true);

      if (error) throw new Error(error.message);

      const results: Array<{
        inbox_id: number;
        action: "notified" | "reset" | "skipped";
      }> = [];

      for (const inbox of inboxes ?? []) {
        const settings = await loadOrgTicketWorkspaceSettings(inbox.org_id);
        const alertHours = settings.inbound_pipeline_alert_hours ?? 48;
        const stale = isPipelineStale(inbox.last_inbound_at, alertHours);

        if (!stale) {
          if (inbox.pipeline_stale_notified_at) {
            await supabaseAdmin
              .from("ticket_inboxes")
              .update({ pipeline_stale_notified_at: null })
              .eq("id", inbox.id);
            results.push({ inbox_id: inbox.id, action: "reset" });
          }
          continue;
        }

        if (settings.inbound_pipeline_alert_email_enabled === false) {
          results.push({ inbox_id: inbox.id, action: "skipped" });
          continue;
        }

        const notifiedAt = inbox.pipeline_stale_notified_at
          ? new Date(inbox.pipeline_stale_notified_at).getTime()
          : 0;
        if (
          notifiedAt &&
          Date.now() - notifiedAt < alertHours * 60 * 60 * 1000
        ) {
          results.push({ inbox_id: inbox.id, action: "skipped" });
          continue;
        }

        if (!(await isOrgTransactionalEmailConfigured(inbox.org_id))) {
          results.push({ inbox_id: inbox.id, action: "skipped" });
          continue;
        }

        const adminEmail = await getPrimaryAdminEmail(inbox.org_id);
        if (!adminEmail) {
          results.push({ inbox_id: inbox.id, action: "skipped" });
          continue;
        }

        const lastInboundLabel = inbox.last_inbound_at
          ? new Date(inbox.last_inbound_at).toLocaleString("en-US", {
            timeZone: settings.business_hours_timezone || "America/New_York",
          })
          : "never";

        await sendTransactionalEmail({
          orgId: inbox.org_id,
          to: adminEmail,
          subject: "Ticket inbound pipeline alert",
          textBody: [
            "No inbound ticket email has been received recently.",
            "",
            `Inbox: ${inbox.email}`,
            `Last inbound: ${lastInboundLabel}`,
            `Alert threshold: ${alertHours} hours`,
            "",
            "Check Hostinger forwarding, SendGrid Inbound Parse, and the Supabase email_inbound webhook.",
          ].join("\n"),
          htmlBody: [
            "<p><strong>Ticket inbound pipeline alert</strong></p>",
            "<p>No inbound ticket email has been received recently.</p>",
            "<ul>",
            `<li><strong>Inbox:</strong> ${inbox.email}</li>`,
            `<li><strong>Last inbound:</strong> ${lastInboundLabel}</li>`,
            `<li><strong>Alert threshold:</strong> ${alertHours} hours</li>`,
            "</ul>",
            "<p>Check Hostinger forwarding, SendGrid Inbound Parse, and the Supabase <code>email_inbound</code> webhook.</p>",
          ].join(""),
          fromEmail: inbox.email,
          fromName: "Nomi Tickets",
          replyTo: inbox.email,
        });

        await supabaseAdmin
          .from("ticket_inboxes")
          .update({ pipeline_stale_notified_at: new Date().toISOString() })
          .eq("id", inbox.id);

        results.push({ inbox_id: inbox.id, action: "notified" });
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("check_ticket_inbound_pipeline.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Pipeline check failed",
      );
    }
  }),
);
