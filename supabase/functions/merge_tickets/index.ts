import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";

type MergeBody = {
  primary_ticket_id?: number;
  merge_ticket_ids?: number[];
  field_overrides?: {
    subject?: string;
    status?: string;
    priority?: string;
    requester_email?: string | null;
    requester_name?: string | null;
    assignee_id?: number | null;
    company_id?: number | null;
    contact_id?: number | null;
    deal_id?: number | null;
  };
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
          return createErrorResponse(403, "You cannot merge tickets");
        }

        const payload = (await req.json()) as MergeBody;
        const primaryTicketId = Number(payload.primary_ticket_id);
        const mergeTicketIds = (payload.merge_ticket_ids ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));

        if (!Number.isFinite(primaryTicketId) || !mergeTicketIds.length) {
          return createErrorResponse(
            400,
            "Invalid primary_ticket_id or merge_ticket_ids",
          );
        }

        const uniqueMergeIds = [
          ...new Set(mergeTicketIds.filter((id) => id !== primaryTicketId)),
        ];

        if (!uniqueMergeIds.length) {
          return createErrorResponse(400, "No tickets selected to merge");
        }

        const allIds = [primaryTicketId, ...uniqueMergeIds];
        const { data: tickets, error: ticketsError } = await supabaseAdmin
          .from("tickets")
          .select(
            "id, org_id, subject, status, merged_into_ticket_id, requester_email",
          )
          .eq("org_id", member.org_id)
          .in("id", allIds);

        if (ticketsError) {
          throw new Error(ticketsError.message);
        }

        if ((tickets ?? []).length !== allIds.length) {
          return createErrorResponse(404, "One or more tickets were not found");
        }

        const primary = tickets?.find(
          (ticket) => ticket.id === primaryTicketId,
        );
        if (!primary) {
          return createErrorResponse(404, "Primary ticket not found");
        }

        if (primary.merged_into_ticket_id) {
          return createErrorResponse(
            400,
            "Cannot merge into a ticket that was already merged elsewhere",
          );
        }

        const now = new Date().toISOString();
        const merged: Array<{ id: number; subject: string }> = [];

        for (const sourceId of uniqueMergeIds) {
          const source = tickets?.find((ticket) => ticket.id === sourceId);
          if (!source) continue;

          if (source.merged_into_ticket_id) {
            return createErrorResponse(
              400,
              `Ticket #${sourceId} was already merged into another ticket`,
            );
          }

          const { error: moveMessagesError } = await supabaseAdmin
            .from("ticket_messages")
            .update({ ticket_id: primaryTicketId })
            .eq("ticket_id", sourceId);

          if (moveMessagesError) {
            throw new Error(moveMessagesError.message);
          }

          const mergeNote = `Merged into ticket #${primaryTicketId} on ${new Date(now).toLocaleString()}.`;

          const { error: markMergedError } = await supabaseAdmin
            .from("tickets")
            .update({
              merged_into_ticket_id: primaryTicketId,
              status: "resolved",
              merge_note: mergeNote,
              updated_at: now,
            })
            .eq("id", sourceId)
            .eq("org_id", member.org_id);

          if (markMergedError) {
            throw new Error(markMergedError.message);
          }

          merged.push({ id: sourceId, subject: source.subject });
        }

        const memberName = [member.first_name, member.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        const mergedIds = merged.map((ticket) => `#${ticket.id}`).join(", ");
        const mergeAuditBody =
          merged.length === 1
            ? `Merged 1 ticket into this thread (${mergedIds}).`
            : `Merged ${merged.length} tickets into this thread (${mergedIds}).`;

        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: primaryTicketId,
          author_member_id: member.id,
          body: mergeAuditBody,
          direction: "internal",
          from_name: memberName || member.email || "Team",
          created_at: now,
        });

        const fieldOverrides = payload.field_overrides ?? {};
        const primaryFieldUpdate: Record<string, unknown> = {
          updated_at: now,
        };

        if (
          typeof fieldOverrides.subject === "string" &&
          fieldOverrides.subject.trim()
        ) {
          primaryFieldUpdate.subject = fieldOverrides.subject.trim();
        }
        if (
          typeof fieldOverrides.status === "string" &&
          fieldOverrides.status.trim()
        ) {
          primaryFieldUpdate.status = fieldOverrides.status.trim();
        }
        if (
          typeof fieldOverrides.priority === "string" &&
          fieldOverrides.priority.trim()
        ) {
          primaryFieldUpdate.priority = fieldOverrides.priority.trim();
        }
        if (fieldOverrides.requester_email !== undefined) {
          primaryFieldUpdate.requester_email =
            fieldOverrides.requester_email?.trim() || null;
        }
        if (fieldOverrides.requester_name !== undefined) {
          primaryFieldUpdate.requester_name =
            fieldOverrides.requester_name?.trim() || null;
        }
        if (fieldOverrides.assignee_id !== undefined) {
          primaryFieldUpdate.assignee_id = fieldOverrides.assignee_id;
        }
        if (fieldOverrides.company_id !== undefined) {
          primaryFieldUpdate.company_id = fieldOverrides.company_id;
        }
        if (fieldOverrides.contact_id !== undefined) {
          primaryFieldUpdate.contact_id = fieldOverrides.contact_id;
        }
        if (fieldOverrides.deal_id !== undefined) {
          primaryFieldUpdate.deal_id = fieldOverrides.deal_id;
        }

        await supabaseAdmin
          .from("tickets")
          .update(primaryFieldUpdate)
          .eq("id", primaryTicketId)
          .eq("org_id", member.org_id);

        return new Response(
          JSON.stringify({
            primary_ticket_id: primaryTicketId,
            merged_ticket_ids: merged.map((ticket) => ticket.id),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("merge_tickets.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
