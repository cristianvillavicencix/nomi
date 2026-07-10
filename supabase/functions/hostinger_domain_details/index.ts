import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { getHostingerApiToken, getHostingerMailApiToken } from "../_shared/hostingerSettings.ts";
import {
  fetchHostingerDnsRecords,
  fetchHostingerDomainDetails,
} from "../_shared/hostingerApi.ts";
import {
  fetchHostingerMailboxes,
  filterMailboxesForDomain,
} from "../_shared/hostingerMailApi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type DetailsBody = {
  domain?: string;
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
        const body = (await req.json().catch(() => ({}))) as DetailsBody;
        const domain = body.domain?.trim().toLowerCase() ?? "";
        if (!domain) {
          return createErrorResponse(400, "Domain is required");
        }

        const apiToken = await getHostingerApiToken(orgId);
        if (!apiToken) {
          throw new Error("Hostinger API token is not configured");
        }

        const { data: cached, error: cachedError } = await supabaseAdmin
          .from("hostinger_domains_summary")
          .select("*")
          .eq("org_id", orgId)
          .eq("domain", domain)
          .maybeSingle();

        if (cachedError) {
          throw new Error(cachedError.message ?? "Failed to load cached domain");
        }

        const details = await fetchHostingerDomainDetails(apiToken, domain);

        let dnsRecords: Awaited<ReturnType<typeof fetchHostingerDnsRecords>> = [];
        let dnsError: string | null = null;
        try {
          dnsRecords = await fetchHostingerDnsRecords(apiToken, domain);
        } catch (error) {
          dnsError = error instanceof Error
            ? error.message
            : "Failed to load DNS records";
        }

        let mailboxes: Awaited<ReturnType<typeof filterMailboxesForDomain>> = [];
        let mailError: string | null = null;
        const mailApiToken = await getHostingerMailApiToken(orgId);
        if (mailApiToken) {
          try {
            const allMailboxes = await fetchHostingerMailboxes(mailApiToken);
            mailboxes = filterMailboxesForDomain(allMailboxes, domain);
          } catch (error) {
            mailError = error instanceof Error
              ? error.message
              : "Failed to load mailboxes";
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            domain,
            cached,
            details,
            dns_records: dnsRecords ?? [],
            dns_error: dnsError,
            mailboxes,
            mail_error: mailError,
            has_mail_api_token: Boolean(mailApiToken),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Failed to load domain details";
        return createErrorResponse(400, message);
      }
    });
  }),
);
