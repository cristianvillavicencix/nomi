import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import {
  assertOrgAdministrator,
  getHostingerApiToken,
  getHostingerMailApiToken,
  getHostingerSettingsPublic,
  updateHostingerSettings,
  upsertHostingerApiToken,
  upsertHostingerMailApiToken,
} from "../_shared/hostingerSettings.ts";
import { testHostingerConnection } from "../_shared/hostingerApi.ts";
import { testHostingerMailConnection } from "../_shared/hostingerMailApi.ts";

type SettingsBody = {
  action?: "get" | "update" | "test" | "test_mail";
  api_token?: string | null;
  mail_api_token?: string | null;
  keepExistingToken?: boolean;
  keepExistingMailToken?: boolean;
  weekly_sync_enabled?: boolean;
  referral_code?: string | null;
  referral_link_template?: string | null;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as SettingsBody;
        const action = body.action ?? "get";

        if (action === "get") {
          const settings = await getHostingerSettingsPublic(orgId);
          return new Response(JSON.stringify(settings), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "test") {
          await assertOrgAdministrator(user, orgId);
          const apiToken = await getHostingerApiToken(orgId);
          if (!apiToken) {
            throw new Error("Hostinger API token is not configured");
          }
          await testHostingerConnection(apiToken);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "test_mail") {
          await assertOrgAdministrator(user, orgId);
          const mailApiToken = await getHostingerMailApiToken(orgId);
          if (!mailApiToken) {
            throw new Error("Hostinger Mail API token is not configured");
          }
          await testHostingerMailConnection(mailApiToken);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        await assertOrgAdministrator(user, orgId);

        const keepExisting = body.keepExistingToken === true ||
          !body.api_token?.trim();
        if (!keepExisting) {
          await upsertHostingerApiToken(orgId, body.api_token!.trim());
        }

        const keepExistingMail = body.keepExistingMailToken === true ||
          !body.mail_api_token?.trim();
        if (!keepExistingMail && body.mail_api_token?.trim()) {
          await upsertHostingerMailApiToken(orgId, body.mail_api_token.trim());
        }

        if (body.weekly_sync_enabled !== undefined) {
          await updateHostingerSettings(orgId, {
            weekly_sync_enabled: body.weekly_sync_enabled === true,
          });
        }

        if (
          body.referral_code !== undefined ||
          body.referral_link_template !== undefined
        ) {
          await updateHostingerSettings(orgId, {
            ...(body.referral_code !== undefined
              ? { referral_code: body.referral_code }
              : {}),
            ...(body.referral_link_template !== undefined
              ? { referral_link_template: body.referral_link_template }
              : {}),
          });
        }

        const settings = await getHostingerSettingsPublic(orgId);
        return new Response(JSON.stringify(settings), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Hostinger settings request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
