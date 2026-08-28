import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";

type MoveBody = {
  source_ticket_id?: number;
  message_ids?: number[];
  target_ticket_id?: number;
  create_new?: boolean;
  subject?: string;
  status?: string;
};

const refreshLastInboundAt = async (ticketId: number) => {
  const { data: latest } = await supabaseAdmin
    .from("ticket_messages")
    .select("created_at")
    .eq("ticket_id", ticketId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabaseAdmin
    .from("tickets")
    .update({
      last_inbound_at: latest?.created_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
};

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
          return createErrorResponse(403, "You cannot move ticket messages");
        }

        const payload = (await req.json()) as MoveBody;
        const sourceTicketId = Number(payload.source_ticket_id);
        const messageIds = [
          ...new Set(
            (payload.message_ids ?? [])
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id)),
          ),
        ];
        const createNew = payload.create_new === true;
        const targetTicketIdRaw = Number(payload.target_ticket_id);

        if (!Number.isFinite(sourceTicketId) || !messageIds.length) {
          return createErrorResponse(
            400,
            "Invalid source_ticket_id or message_ids",
          );
        }

        if (!createNew && !Number.isFinite(targetTicketIdRaw)) {
          return createErrorResponse(
            400,
            "Provide target_ticket_id or create_new: true",
          );
        }

        if (createNew && Number.isFinite(targetTicketIdRaw)) {
          return createErrorResponse(
            400,
            "Use either target_ticket_id or create_new, not both",
          );
        }

        const { data: source, error: sourceError } = await supabaseAdmin
          .from("tickets")
          .select(
            "id, org_id, subject, status, priority, inbox_address, requester_email, requester_name, company_id, contact_id, deal_id, assignee_id, organization_member_id, merged_into_ticket_id",
          )
          .eq("org_id", member.org_id)
          .eq("id", sourceTicketId)
          .maybeSingle();

        if (sourceError) throw new Error(sourceError.message);
        if (!source) {
          return createErrorResponse(404, "Source ticket not found");
        }
        if (source.merged_into_ticket_id) {
          return createErrorResponse(
            400,
            "Cannot move messages from a ticket that was already merged elsewhere",
          );
        }

        const { data: messages, error: messagesError } = await supabaseAdmin
          .from("ticket_messages")
          .select("id, ticket_id")
          .eq("ticket_id", sourceTicketId)
          .in("id", messageIds);

        if (messagesError) throw new Error(messagesError.message);

        if ((messages ?? []).length !== messageIds.length) {
          return createErrorResponse(
            400,
            "One or more messages were not found on the source ticket",
          );
        }

        let targetTicketId = targetTicketIdRaw;
        const now = new Date().toISOString();
        const memberName = [member.first_name, member.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        const fromName = memberName || member.email || "Team";

        if (createNew) {
          const subjectOverride = payload.subject?.trim();
          const statusOverride = payload.status?.trim();
          const newSubject =
            subjectOverride ||
            `Split from #${sourceTicketId}: ${source.subject ?? "Ticket"}`;

          const { data: created, error: createError } = await supabaseAdmin
            .from("tickets")
            .insert({
              org_id: source.org_id,
              subject: newSubject,
              status: statusOverride || "open",
              priority: source.priority || "normal",
              inbox_address: source.inbox_address,
              requester_email: source.requester_email,
              requester_name: source.requester_name,
              company_id: source.company_id,
              contact_id: source.contact_id,
              deal_id: source.deal_id,
              assignee_id: source.assignee_id,
              organization_member_id: source.organization_member_id,
              created_at: now,
              updated_at: now,
            })
            .select("id")
            .single();

          if (createError || !created?.id) {
            throw new Error(createError?.message ?? "Failed to create ticket");
          }
          targetTicketId = Number(created.id);
        } else {
          if (targetTicketId === sourceTicketId) {
            return createErrorResponse(
              400,
              "Target ticket must be different from the source ticket",
            );
          }

          const { data: target, error: targetError } = await supabaseAdmin
            .from("tickets")
            .select("id, org_id, merged_into_ticket_id")
            .eq("org_id", member.org_id)
            .eq("id", targetTicketId)
            .maybeSingle();

          if (targetError) throw new Error(targetError.message);
          if (!target) {
            return createErrorResponse(404, "Target ticket not found");
          }
          if (target.merged_into_ticket_id) {
            return createErrorResponse(
              400,
              "Cannot move messages into a ticket that was already merged elsewhere",
            );
          }
        }

        const { error: moveError } = await supabaseAdmin
          .from("ticket_messages")
          .update({ ticket_id: targetTicketId })
          .eq("ticket_id", sourceTicketId)
          .in("id", messageIds);

        if (moveError) throw new Error(moveError.message);

        const count = messageIds.length;
        const sourceAudit =
          count === 1
            ? `Moved 1 message to ticket #${targetTicketId}.`
            : `Moved ${count} messages to ticket #${targetTicketId}.`;
        const targetAudit =
          count === 1
            ? `Received 1 message split from ticket #${sourceTicketId}.`
            : `Received ${count} messages split from ticket #${sourceTicketId}.`;

        await supabaseAdmin.from("ticket_messages").insert([
          {
            ticket_id: sourceTicketId,
            author_member_id: member.id,
            body: sourceAudit,
            direction: "internal",
            from_name: fromName,
            created_at: now,
          },
          {
            ticket_id: targetTicketId,
            author_member_id: member.id,
            body: targetAudit,
            direction: "internal",
            from_name: fromName,
            created_at: now,
          },
        ]);

        await refreshLastInboundAt(sourceTicketId);
        await refreshLastInboundAt(targetTicketId);

        return new Response(
          JSON.stringify({
            source_ticket_id: sourceTicketId,
            target_ticket_id: targetTicketId,
            moved_message_ids: messageIds,
            created_new: createNew,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("move_ticket_messages.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
