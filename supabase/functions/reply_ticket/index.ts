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
import {
  isTicketAwaitingPaidDelivery,
  TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE,
} from "../_shared/ticketOutboundAttachments.ts";
import {
  isTicketReplyAttachmentTooLarge,
  resolveInlineReplyAttachmentMaxBytes,
  shouldSendReplyAttachmentAsDownloadLink,
  TICKET_REPLY_ATTACHMENT_TOO_LARGE_MESSAGE,
} from "../_shared/ticketReplyAttachmentLimits.ts";
import {
  appendReplyDownloadLinksToHtml,
  appendReplyDownloadLinksToText,
  buildReplyAttachmentDownloadLinks,
} from "../_shared/ticketReplyDownloadLinks.ts";
import { loadOrgTicketWorkspaceSettings } from "../_shared/ticketWorkspaceSettings.ts";
import { buildEmailThreadHeaders } from "../_shared/emailThreading.ts";
import { stripCidFromHtml } from "../_shared/stripCidFromHtml.ts";
import {
  stripComposerQuotedHtml,
  stripComposerQuotedPlainText,
  stripQuotedHtml,
  stripQuotedPlainText,
} from "../_shared/ticketEmailQuotedContent.ts";

type ReplyBody = {
  ticket_id?: number;
  body?: string;
  html_body?: string;
  is_internal_note?: boolean;
  attachments?: StoredAttachment[];
  to_emails?: string[];
  cc_emails?: string[];
  next_status?: string;
};

const TICKET_STATUSES = new Set(["new", "open", "waiting", "resolved"]);

const requiresStatusChangeNote = (fromStatus: string, toStatus: string) => {
  if (fromStatus === toStatus) return false;
  if (toStatus === "waiting" || toStatus === "resolved") return true;
  if (fromStatus === "resolved") return true;
  return false;
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
            "id, org_id, subject, inbox_address, requester_email, requester_name, external_thread_id, merged_into_ticket_id, status, invoice_id, delivery_status",
          )
          .eq("id", ticketId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (ticketError || !ticket) {
          return createErrorResponse(404, "Ticket not found");
        }

        if (ticket.merged_into_ticket_id) {
          return createErrorResponse(
            400,
            "This ticket was merged into another",
          );
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
            throw new Error(
              messageError?.message ?? "Could not save internal note",
            );
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
          return createErrorResponse(
            400,
            "Enter at least one valid recipient email",
          );
        }

        const workspace = await loadOrgTicketWorkspaceSettings(member.org_id);
        const inlineAttachmentMaxBytes = resolveInlineReplyAttachmentMaxBytes(
          workspace.max_reply_attachment_bytes,
        );

        if (attachments.length > 0) {
          const oversized = attachments.find(
            (file) =>
              typeof file.size === "number" &&
              isTicketReplyAttachmentTooLarge(file.size),
          );
          if (oversized) {
            return createErrorResponse(
              400,
              TICKET_REPLY_ATTACHMENT_TOO_LARGE_MESSAGE,
            );
          }

          let invoiceStatus: string | null = null;
          if (ticket.invoice_id) {
            const { data: invoice } = await supabaseAdmin
              .from("client_invoices")
              .select("status")
              .eq("id", ticket.invoice_id)
              .eq("org_id", member.org_id)
              .maybeSingle();
            invoiceStatus = invoice?.status ?? null;
          }

          if (
            isTicketAwaitingPaidDelivery({
              invoiceId: ticket.invoice_id,
              deliveryStatus: ticket.delivery_status,
              invoiceStatus,
            })
          ) {
            return createErrorResponse(
              400,
              TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE,
            );
          }
        }

        let inboxAddress = ticket.inbox_address?.trim().toLowerCase() ?? "";
        let fromName = "LBS Supplements";

        if (inboxAddress) {
          const { data: inbox } = await supabaseAdmin
            .from("ticket_inboxes")
            .select("email, from_name, display_name, is_active")
            .eq("org_id", member.org_id)
            .eq("email", inboxAddress)
            .maybeSingle();
          if (inbox?.is_active === false) {
            return createErrorResponse(
              400,
              "Ticket email sending is paused. Re-enable it under Settings → Integrations → Mail.",
            );
          }
          if (!inbox?.email?.trim()) {
            // Inbox was removed after the ticket was created — fall back below.
            inboxAddress = "";
          } else if (inbox.from_name?.trim()) {
            fromName = inbox.from_name.trim();
          } else if (inbox.display_name?.trim()) {
            fromName = inbox.display_name.trim();
          }
        }

        if (!inboxAddress) {
          const { data: defaultInbox } = await supabaseAdmin
            .from("ticket_inboxes")
            .select("email, from_name, display_name, is_active")
            .eq("org_id", member.org_id)
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!defaultInbox?.email?.trim()) {
            const { data: pausedInbox } = await supabaseAdmin
              .from("ticket_inboxes")
              .select("email, is_active")
              .eq("org_id", member.org_id)
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (pausedInbox && pausedInbox.is_active === false) {
              return createErrorResponse(
                400,
                "Ticket email sending is paused. Re-enable it under Settings → Integrations → Mail.",
              );
            }
          }
          inboxAddress = defaultInbox?.email?.trim().toLowerCase() ?? "";
          if (defaultInbox?.from_name?.trim()) {
            fromName = defaultInbox.from_name.trim();
          } else if (defaultInbox?.display_name?.trim()) {
            fromName = defaultInbox.display_name.trim();
          }
        }

        if (!inboxAddress) {
          return createErrorResponse(
            400,
            "No ticket inbox configured for replies",
          );
        }

        const { data: priorMessages } = await supabaseAdmin
          .from("ticket_messages")
          .select("external_message_id, direction")
          .eq("ticket_id", ticket.id)
          .not("external_message_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(50);

        const priorMessageIds = (priorMessages ?? [])
          .map((row) => row.external_message_id)
          .filter((id): id is string => Boolean(id?.trim()));

        const lastInboundId = [...(priorMessages ?? [])]
          .reverse()
          .find((row) => row.direction === "inbound")
          ?.external_message_id?.trim();

        const outboundMessageId = buildMessageId(ticket.id);
        const threadHeaders = buildEmailThreadHeaders({
          messageId: outboundMessageId,
          inReplyTo:
            ticket.external_thread_id?.trim() ||
            lastInboundId ||
            priorMessageIds[priorMessageIds.length - 1] ||
            null,
          priorMessageIds,
        });

        const subject = replySubject(ticket.subject);

        const linkAttachments = attachments.filter((file) =>
          shouldSendReplyAttachmentAsDownloadLink(
            file.size,
            inlineAttachmentMaxBytes,
            file.send_as_download_link === true,
          ),
        );
        const inlineAttachments = attachments.filter(
          (file) =>
            !shouldSendReplyAttachmentAsDownloadLink(
              file.size,
              inlineAttachmentMaxBytes,
              file.send_as_download_link === true,
            ),
        );

        let downloadLinks: Awaited<
          ReturnType<typeof buildReplyAttachmentDownloadLinks>
        > = [];
        if (linkAttachments.length > 0) {
          try {
            downloadLinks =
              await buildReplyAttachmentDownloadLinks(linkAttachments);
          } catch (linkError) {
            const message =
              linkError instanceof Error
                ? linkError.message
                : "Could not create download links for large attachments";
            return createErrorResponse(502, message);
          }
        }

        const textBody = appendReplyDownloadLinksToText(
          body || (attachments.length > 0 ? "(See attachments)" : ""),
          downloadLinks,
        );
        let outboundHtmlBody = htmlBody
          ? stripCidFromHtml(htmlBody)
          : undefined;
        outboundHtmlBody = appendReplyDownloadLinksToHtml(
          outboundHtmlBody,
          downloadLinks,
        );

        const { attachments: emailAttachments } =
          await loadStorageAttachmentsForEmail(inlineAttachments);

        let emailResult;
        try {
          emailResult = await sendTransactionalEmail({
            orgId: member.org_id,
            to: recipients,
            cc: ccEmails.length ? ccEmails : undefined,
            subject,
            textBody,
            htmlBody: outboundHtmlBody || undefined,
            fromEmail: inboxAddress,
            fromName,
            replyTo: inboxAddress,
            attachments: emailAttachments,
            headers: threadHeaders,
          });
        } catch (emailError) {
          const message =
            emailError instanceof Error
              ? emailError.message
              : "Could not send ticket email";
          console.error("reply_ticket.email_failed", {
            ticketId: ticket.id,
            inboxAddress,
            message,
          });
          return createErrorResponse(502, message);
        }

        const emailDeliveryStatus = emailResult.skipped ? "skipped" : "sent";

        const storedBody =
          stripComposerQuotedPlainText(stripQuotedPlainText(body)) ||
          body ||
          "(See attachments)";
        const storedHtmlBody = outboundHtmlBody
          ? stripComposerQuotedHtml(stripQuotedHtml(outboundHtmlBody)) || null
          : null;

        const { data: message, error: messageError } = await supabaseAdmin
          .from("ticket_messages")
          .insert({
            ticket_id: ticket.id,
            author_member_id: member.id,
            body: storedBody,
            html_body: storedHtmlBody,
            direction: "outbound",
            from_email: inboxAddress,
            from_name: memberName || fromName,
            to_emails: recipients,
            cc_emails: ccEmails,
            external_message_id: outboundMessageId,
            attachments,
            email_delivery_status: emailDeliveryStatus,
            created_at: now,
          })
          .select("*")
          .single();

        if (messageError || !message) {
          throw new Error(messageError?.message ?? "Could not save reply");
        }

        const requestedStatus = payload.next_status?.trim() ?? "";
        const nextStatus = TICKET_STATUSES.has(requestedStatus)
          ? requestedStatus
          : ticket.status === "new"
            ? "open"
            : ticket.status;

        if (
          nextStatus !== ticket.status &&
          requiresStatusChangeNote(ticket.status, nextStatus)
        ) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            author_member_id: member.id,
            body: `**Status:** ${ticket.status} → ${nextStatus}\n\nStatus updated when sending reply.`,
            direction: "internal",
            from_name: memberName || member.email || "Team",
            attachments: [],
            created_at: now,
          });
        }

        await supabaseAdmin
          .from("tickets")
          .update({
            status: nextStatus,
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
