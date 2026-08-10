import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { parseRawEmailInbound } from "../_shared/parseRawEmailInbound.ts";
import { resolveMaxInboundAttachmentBytes } from "../_shared/inboundAttachmentLimits.ts";
import { loadOrgTicketWorkspaceSettings } from "../_shared/ticketWorkspaceSettings.ts";
import {
  matchesTicketInbox,
  processTicketInbound,
} from "../postmark/processTicketInbound.ts";

const canImportTicketEmail = (
  member: Awaited<ReturnType<typeof getUserOrganizationMember>>,
) =>
  Boolean(
    member &&
      (hasMemberCapability(member, "support.tickets.manage") ||
        member.administrator === true),
  );

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) return createErrorResponse(401, "Unauthorized");

      const member = await getUserOrganizationMember(user);
      if (!member?.org_id || !canImportTicketEmail(member)) {
        return createErrorResponse(403, "Forbidden");
      }

      try {
        const contentType = req.headers.get("content-type") ?? "";
        let rawEml: Uint8Array;

        if (contentType.includes("multipart/form-data")) {
          const form = await req.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return createErrorResponse(400, "Missing .eml file");
          }
          rawEml = new Uint8Array(await file.arrayBuffer());
        } else {
          const body = (await req.json()) as { eml_base64?: string };
          const encoded = body.eml_base64?.trim();
          if (!encoded) {
            return createErrorResponse(400, "Missing eml_base64 or multipart file");
          }
          rawEml = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        }

        const workspaceSettings = await loadOrgTicketWorkspaceSettings(
          member.org_id,
        );
        const maxBytes = resolveMaxInboundAttachmentBytes(
          workspaceSettings.max_inbound_attachment_bytes,
        );

        const { payload, attachments, skippedAttachments } =
          await parseRawEmailInbound(rawEml, maxBytes);

        const inbox = await matchesTicketInbox(payload);
        if (!inbox || inbox.org_id !== member.org_id) {
          return createErrorResponse(
            400,
            "No matching ticket inbox for this organization",
          );
        }

        const response = await processTicketInbound({
          payload,
          attachments,
          skippedAttachments,
          source: "manual_import",
        });

        const responseBody = await response.json();
        return new Response(JSON.stringify(responseBody), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("import_ticket_email.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Import failed",
        );
      }
    });
  }),
);
