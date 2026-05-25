import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  extractFieldValue,
  validateAnswersAgainstSchema,
  type FormSchema,
} from "../_shared/formV2Schema.ts";
import { handlePostSubmitActions } from "../_shared/formV2PostSubmit.ts";
import { notifyTeamOnSubmit } from "../_shared/notifyFormSubmission.ts";

type SubmitBody = {
  token?: string;
  answers?: Record<string, unknown>;
  recaptcha_token?: string;
  honeypot?: string;
  metadata?: {
    source_url?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    app_base_url?: string;
  };
};

const RECAPTCHA_SECRET = Deno.env.get("RECAPTCHA_SECRET_KEY");

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as SubmitBody;
      const answers = body.answers ?? {};

      if (body.honeypot && body.honeypot.trim() !== "") {
        return jsonResponse({ ok: true });
      }

      const token = String(body.token ?? "").trim();
      if (!token) {
        return jsonResponse({ error: "Missing form token" }, 400);
      }

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("public_form_tokens")
        .select("*, form_instance:form_instances(*)")
        .eq("token", token)
        .single();

      if (tokenError || !tokenData) {
        return jsonResponse({ error: "Invalid or expired form link" }, 404);
      }

      if (tokenData.is_preview) {
        const formInstance = tokenData.form_instance as Record<string, unknown>;
        const validationErrors = validateAnswersAgainstSchema(
          answers,
          formInstance.schema as FormSchema,
        );
        if (validationErrors.length > 0) {
          return jsonResponse(
            { error: "Validation failed", details: validationErrors },
            400,
          );
        }
        return jsonResponse({
          ok: true,
          preview: true,
          thank_you_title: formInstance.thank_you_title,
          thank_you_message: formInstance.thank_you_message,
          redirect_url: formInstance.redirect_url,
        });
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return jsonResponse({ error: "This form link has expired" }, 410);
      }

      if (
        tokenData.max_uses != null &&
        tokenData.uses_count >= tokenData.max_uses
      ) {
        return jsonResponse(
          { error: "This form link has reached its submission limit" },
          410,
        );
      }

      const formInstance = tokenData.form_instance as Record<string, unknown>;
      if (!formInstance || formInstance.is_active === false) {
        return jsonResponse({ error: "This form is not available" }, 404);
      }

      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const userAgent = req.headers.get("user-agent");

      const rateLimit = Number(formInstance.rate_limit_per_ip_per_hour ?? 5);
      if (rateLimit > 0 && clientIp) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: recentSubs } = await supabaseAdmin
          .from("form_submissions_v2")
          .select("id", { count: "exact", head: true })
          .eq("form_instance_id", formInstance.id)
          .eq("ip_address", clientIp)
          .gte("submitted_at", oneHourAgo);

        if ((recentSubs ?? 0) >= rateLimit) {
          await supabaseAdmin.from("form_submission_events").insert({
            org_id: formInstance.org_id,
            form_instance_id: formInstance.id,
            event_type: "rate_limited",
            ip_address: clientIp,
            user_agent: userAgent,
          });
          return jsonResponse(
            {
              error:
                "Too many submissions from this address. Please try again later.",
            },
            429,
          );
        }
      }

      if (formInstance.recaptcha_enabled && RECAPTCHA_SECRET) {
        if (!body.recaptcha_token) {
          return jsonResponse(
            { error: "reCAPTCHA verification required" },
            400,
          );
        }

        const recaptchaResponse = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${RECAPTCHA_SECRET}&response=${body.recaptcha_token}`,
          },
        );
        const recaptchaResult = await recaptchaResponse.json();

        if (
          !recaptchaResult.success ||
          (typeof recaptchaResult.score === "number" &&
            recaptchaResult.score < 0.5)
        ) {
          await supabaseAdmin.from("form_submission_events").insert({
            org_id: formInstance.org_id,
            form_instance_id: formInstance.id,
            event_type: "spam_blocked",
            ip_address: clientIp,
            user_agent: userAgent,
          });
          return jsonResponse({ error: "reCAPTCHA validation failed" }, 400);
        }
      }

      const validationErrors = validateAnswersAgainstSchema(
        answers,
        formInstance.schema as FormSchema,
      );
      if (validationErrors.length > 0) {
        return jsonResponse(
          { error: "Validation failed", details: validationErrors },
          400,
        );
      }

      const { data: submission, error: insertError } = await supabaseAdmin
        .from("form_submissions_v2")
        .insert({
          org_id: formInstance.org_id,
          form_instance_id: formInstance.id,
          answers,
          contact_id: tokenData.contact_id,
          company_id: tokenData.company_id,
          deal_id: tokenData.deal_id,
          submitter_email: extractFieldValue(answers, [
            "email",
            "respondent_email",
          ]),
          submitter_phone: extractFieldValue(answers, [
            "phone",
            "submitter_phone",
          ]),
          submitter_name: extractFieldValue(answers, [
            "name",
            "full_name",
            "submitter_name",
          ]),
          ip_address: clientIp,
          user_agent: userAgent,
          source_url: body.metadata?.source_url ?? null,
          utm_source: body.metadata?.utm_source ?? null,
          utm_medium: body.metadata?.utm_medium ?? null,
          utm_campaign: body.metadata?.utm_campaign ?? null,
          status: "new",
        })
        .select()
        .single();

      if (insertError || !submission) {
        console.error("[submit_form_v2] Insert failed:", insertError);
        return jsonResponse(
          {
            error: "Could not save your submission. Please try again.",
            debug: insertError?.message,
          },
          500,
        );
      }

      await supabaseAdmin
        .from("public_form_tokens")
        .update({ uses_count: (tokenData.uses_count ?? 0) + 1 })
        .eq("id", tokenData.id);

      await supabaseAdmin.from("form_submission_events").insert({
        org_id: formInstance.org_id,
        form_instance_id: formInstance.id,
        submission_id: submission.id,
        event_type: "submitted",
        ip_address: clientIp,
        user_agent: userAgent,
      });

      await handlePostSubmitActions(
        supabaseAdmin,
        formInstance as {
          id: number;
          org_id: number;
          name?: string | null;
          slug?: string | null;
          auto_create_contact?: boolean | null;
          auto_create_lead?: boolean | null;
          auto_create_task?: boolean | null;
          notify_member_ids?: number[] | null;
          task_assignee_member_id?: number | null;
          task_title_template?: string | null;
        },
        submission,
        answers,
      );

      if (formInstance.template_id && submission.deal_id) {
        const { data: template } = await supabaseAdmin
          .from("form_templates")
          .select("type")
          .eq("id", formInstance.template_id)
          .single();

        if (template?.type === "project_brief") {
          await supabaseAdmin
            .from("deals")
            .update({ website_brief: answers })
            .eq("id", submission.deal_id);
        }
      }

      if (formInstance.notify_on_submit) {
        await notifyTeamOnSubmit(
          supabaseAdmin,
          formInstance as {
            id: number;
            org_id: number;
            name: string;
            notify_on_submit?: boolean | null;
            notify_member_ids?: number[] | null;
          },
          submission,
          { appBaseUrl: body.metadata?.app_base_url },
        );
      }

      return jsonResponse({
        ok: true,
        submission_id: submission.id,
        thank_you_title: formInstance.thank_you_title,
        thank_you_message: formInstance.thank_you_message,
        redirect_url: formInstance.redirect_url,
      });
    } catch (error) {
      console.error("[submit_form_v2] Unhandled error:", error);
      return jsonResponse(
        {
          error: "Internal server error",
          debug: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  }),
);
