import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { notifyTaskRescheduled } from "../_shared/notifyTaskRescheduled.ts";

type Body = {
  task_id?: number;
  previous_due_date?: string | null;
  app_base_url?: string | null;
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
        if (!member?.id || !member.org_id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "crm.tasks.view")
        ) {
          return createErrorResponse(
            403,
            "You cannot send task notifications",
          );
        }

        const body = (await req.json()) as Body;
        const taskId = Number(body.task_id);
        if (!Number.isFinite(taskId) || taskId <= 0) {
          return createErrorResponse(400, "task_id is required");
        }

        const result = await notifyTaskRescheduled(supabaseAdmin, {
          orgId: member.org_id,
          taskId,
          editorMemberId: Number(member.id),
          previousDueDate: body.previous_due_date ?? null,
          appBaseUrl: body.app_base_url,
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("notify_task_rescheduled.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
