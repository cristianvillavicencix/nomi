import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { sendTransactionalEmail } from "../_shared/transactionalEmail.ts";
import {
  loadStorageAttachmentsForEmail,
  type StoredAttachment,
} from "../_shared/storageAttachmentsForEmail.ts";

type ReplyBody = {
  ticket_id?: number;
  body?: string;
  html_body?: string;
  is_internal_note?: boolean;
  attachments?: StoredAttachment[];
  to_emails?: string[];
  cc_emails?: string[];
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmails = (values: string[] | undefined) =>
  (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => emailRegex.test(value));

const replySubject = (subject: string) => {
  const trimmed = subject.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
};

const buildMessageId = (ticketId: number) =>
  `<ticket-${ticketId}-${crypto.randomUUID()}@nomicrm.com>`;

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "support.tickets.manage")
        ) {
          return createErrorResponse(403, "You cannot reply to tickets");
        }

        const payload = (await req.json()) as ReplyBody;
        const ticketId = Number(payload.ticket_id);
        const body = payload.body?.trim() ?? "";
        const htmlBody = payload.html_body?.trim() ?? "";
        const isInternalNote = payload.is_internal_note === true;
        const attachments = (payload.attachments ?? []).filter(
          (file) => file?.path?.trim() || file?.src?.trim(),
        );

        if (!Number.isFinite(ticketId) || (!body && attachments.length === 0)) {
          return createErrorResponse(400, "Invalid ticket_id or empty message");
        }

        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from("tickets")
          .select(
            "id, org_id, subject, inbox_address, requester_email, requester_name, external_thread_id, merged_into_ticket_id, status",
          )
          .eq("id", ticketId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (ticketError || !ticket) {
          return createErrorResponse(404, "Ticket not found");
        }

        if (ticket.merged_into_ticket_id) {
          return createErrorResponse(400, "This ticket was merged into another");
        }

        const now = new Date().toISOString();
        const memberName = [member.first_name, member.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (isInternalNote) {
          const { data: message, error: messageError } = await supabaseAdmin
            .from("ticket_messages")
            .insert({
              ticket_id: ticket.id,
              author_member_id: member.id,
              body: body || "(Attachment)",
              direction: "internal",
              from_name: memberName || member.email || "Team",
              attachments,
              created_at: now,
            })
            .select("*")
            .single();

          if (messageError || !message) {
            throw new Error(messageError?.message ?? "Could not save internal note");
          }

          await supabaseAdmin
            .from("tickets")
            .update({ updated_at: now })
            .eq("id", ticket.id)
            .eq("org_id", member.org_id);

          return new Response(
            JSON.stringify({
              message,
              email_sent: false,
              email_skipped: true,
              is_internal_note: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const toEmails = normalizeEmails(payload.to_emails);
        const ccEmails = normalizeEmails(payload.cc_emails);
        const fallbackTo = ticket.requester_email?.trim().toLowerCase() ?? "";
        const recipients = toEmails.length
          ? toEmails
          : fallbackTo && emailRegex.test(fallbackTo)
            ? [fallbackTo]
            : [];

        if (!recipients.length) {
          return createErrorResponse(400, "Enter at least one valid recipient email");
        }

        if (attachments.length > 0) {
          const { data: ticketDelivery } = await supabaseAdmin
            .from("tickets")
            .select("delivery_status")
            .eq("id", ticket.id)
            .eq("org_id", member.org_id)
            .maybeSingle();

          if (ticketDelivery?.delivery_status !== "delivered") {
            return createErrorResponse(
              400,
              "Outbound attachments are blocked until payment delivery completes. Use the delivery package instead.",
            );
          }
        }

        let inboxAddress = ticket.inbox_address?.trim().toLowerCase() ?? "";
        let fromName = "LBS Supplements";

        if (inboxAddress) {
          const { data: inbox } = await supabaseAdmin
            .from("ticket_inboxes")
            .select("email, from_name, display_name")
            .eq("org_id", member.org_id)
            .eq("email", inboxAddress)
            .maybeSingle();
          if (inbox?.from_name?.trim()) fromName = inbox.from_name.trim();
          else if (inbox?.display_name?.trim()) {
            fromName = inbox.display_name.trim();
          }
        } else {
          const { data: defaultInbox } = await supabaseAdmin
            .from("ticket_inboxes")
            .select("email, from_name, display_name")
            .eq("org_id", member.org_id)
            .eq("is_active", true)
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();
          inboxAddress = defaultInbox?.email?.trim().toLowerCase() ?? "";
          if (defaultInbox?.from_name?.trim()) {
            fromName = defaultInbox.from_name.trim();
          }
        }

        if (!inboxAddress) {
          return createErrorResponse(400, "No ticket inbox configured for replies");
        }

        const outboundMessageId = buildMessageId(ticket.id);
        const subject = replySubject(ticket.subject);
        const textBody = body || "(See attachments)";
        const emailAttachments = await loadStorageAttachmentsForEmail(attachments);

        const emailResult = await sendTransactionalEmail({
          orgId: member.org_id,
          to: recipients,
          cc: ccEmails.length ? ccEmails : undefined,
          subject,
          textBody,
          htmlBody: htmlBody || undefined,
          fromEmail: inboxAddress,
          fromName,
          replyTo: inboxAddress,
          attachments: emailAttachments,
        });

        const { data: message, error: messageError } = await supabaseAdmin
          .from("ticket_messages")
          .insert({
            ticket_id: ticket.id,
            author_member_id: member.id,
            body: body || "(See attachments)",
            html_body: htmlBody || null,
            direction: "outbound",
            from_email: inboxAddress,
            from_name: memberName || fromName,
            to_emails: recipients,
            external_message_id: outboundMessageId,
            attachments,
            created_at: now,
          })
          .select("*")
          .single();

        if (messageError || !message) {
          throw new Error(messageError?.message ?? "Could not save reply");
        }

        await supabaseAdmin
          .from("tickets")
          .update({
            status: ticket.status === "new" ? "waiting" : ticket.status,
            assignee_id: member.id,
            updated_at: now,
          })
          .eq("id", ticket.id)
          .eq("org_id", member.org_id);

        return new Response(
          JSON.stringify({
            message,
            email_sent: !emailResult.skipped,
            email_skipped: emailResult.skipped,
            is_internal_note: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("reply_ticket.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
