import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";
import { buildMemberCalendarFeedIcs } from "../_shared/calendarFeedData.ts";

const feedCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const resolveSupabaseFunctionsBase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return `${supabaseUrl}/functions/v1/calendar_feed`;
};

const buildFeedUrls = (token: string) => {
  const httpsUrl = `${resolveSupabaseFunctionsBase()}?token=${encodeURIComponent(token)}`;
  const webcalUrl = httpsUrl.replace(/^https?:/i, "webcal:");
  return { feed_url: httpsUrl, webcal_url: webcalUrl };
};

const handleGetFeed = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return createErrorResponse(400, "Missing token");
  }

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("member_calendar_feed_tokens")
    .select("id, org_id, organization_member_id")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) {
    console.error("[calendar_feed] token lookup failed", tokenError);
    return createErrorResponse(500, "Failed to load subscription");
  }

  if (!tokenRow?.organization_member_id) {
    return createErrorResponse(404, "Subscription not found");
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("organization_members")
    .select("id, org_id, first_name, last_name, disabled")
    .eq("id", tokenRow.organization_member_id)
    .maybeSingle();

  if (memberError || !member?.id || member.disabled) {
    return createErrorResponse(404, "Subscription not found");
  }

  if (member.org_id !== tokenRow.org_id) {
    return createErrorResponse(404, "Subscription not found");
  }

  await supabaseAdmin
    .from("member_calendar_feed_tokens")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  try {
    const ics = await buildMemberCalendarFeedIcs(supabaseAdmin, {
      id: member.id,
      org_id: member.org_id,
      first_name: member.first_name,
      last_name: member.last_name,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        ...feedCorsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="nomi-calendar.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[calendar_feed] build failed", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Failed to build calendar feed",
    );
  }
};

type EnsureBody = {
  regenerate?: boolean;
};

const handleEnsureToken = async (req: Request): Promise<Response> => {
  return UserMiddleware(req, async (_req, user) => {
    if (!user) {
      return createErrorResponse(401, "Unauthorized");
    }

    const member = await getUserOrganizationMember(user);
    if (!member?.id || !member.org_id) {
      return createErrorResponse(401, "Unauthorized");
    }

    if (
      !member.administrator &&
      !hasMemberCapability(member, "calendar.view")
    ) {
      return createErrorResponse(403, "You cannot subscribe to the calendar");
    }

    let body: EnsureBody = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text) as EnsureBody;
      }
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("member_calendar_feed_tokens")
      .select("id, token")
      .eq("organization_member_id", member.id)
      .maybeSingle();

    if (existingError) {
      console.error("[calendar_feed] existing token lookup failed", existingError);
      return createErrorResponse(500, "Failed to load subscription token");
    }

    if (existing?.token && !body.regenerate) {
      const urls = buildFeedUrls(existing.token);
      return new Response(
        JSON.stringify({
          token: existing.token,
          ...urls,
        }),
        {
          headers: {
            ...feedCorsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const token = generateSecureToken();

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("member_calendar_feed_tokens")
        .update({ token, created_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[calendar_feed] token rotate failed", updateError);
        return createErrorResponse(500, "Failed to regenerate subscription");
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("member_calendar_feed_tokens")
        .insert({
          org_id: member.org_id,
          organization_member_id: member.id,
          token,
        });

      if (insertError) {
        console.error("[calendar_feed] token create failed", insertError);
        return createErrorResponse(500, "Failed to create subscription");
      }
    }

    const urls = buildFeedUrls(token);
    return new Response(
      JSON.stringify({
        token,
        ...urls,
      }),
      {
        headers: {
          ...feedCorsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  });
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: feedCorsHeaders });
  }

  if (req.method === "GET") {
    return handleGetFeed(req);
  }

  if (req.method === "POST") {
    return handleEnsureToken(req);
  }

  return createErrorResponse(405, "Method not allowed");
});
