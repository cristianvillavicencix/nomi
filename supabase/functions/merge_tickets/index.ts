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

        const primary = tickets?.find((ticket) => ticket.id === primaryTicketId);
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

        const summary = merged
          .map((ticket) => `#${ticket.id} (${ticket.subject})`)
          .join(", ");

        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: primaryTicketId,
          author_member_id: member.id,
          body: `Merged tickets: ${summary}`,
          direction: "internal",
          from_name: memberName || member.email || "Team",
          created_at: now,
        });

        await supabaseAdmin
          .from("tickets")
          .update({
            status: primary.status === "resolved" ? "open" : primary.status,
            updated_at: now,
          })
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
