import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { callAnthropicMessages } from "../_shared/crmAssistant/anthropicClient.ts";
import { assertAssistantRateLimit } from "../_shared/crmAssistant/rateLimit.ts";
import { runAssistantTool } from "../_shared/crmAssistant/runTool.ts";
import { CRM_ASSISTANT_SYSTEM_PROMPT } from "../_shared/crmAssistant/systemPrompt.ts";
import { sanitizeAssistantReply } from "../_shared/crmAssistant/sanitizeReply.ts";
import { executePendingAction } from "../_shared/crmAssistant/executePending.ts";
import { toAnthropicToolDefs } from "../_shared/crmAssistant/toolRegistry.ts";
import { normalizeAssistantSettings } from "../_shared/crmAssistant/assistantSettings.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type {
  AnthropicContentBlock,
  AnthropicMessage,
  AssistantMember,
  PendingAction,
  ToolContext,
} from "../_shared/crmAssistant/types.ts";

const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY_MESSAGES = 50;
const PENDING_TTL_MS = 15 * 60_000;

type RequestBody = {
  action?:
    | "status"
    | "update_settings"
    | "chat"
    | "list_conversations"
    | "get_conversation";
  enabled?: boolean;
  conversation_id?: number | null;
  message?: string;
  confirm_action_id?: string;
};

type StoredPending = PendingAction & {
  member_id: number;
  org_id: number;
  conversation_id: number;
  expires_at: number;
};

const pendingActions = new Map<string, StoredPending>();

const publishableKey =
  Deno.env.get("SB_PUBLISHABLE_KEY") ??
  Deno.env.get("PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

const createUserClient = (authHeader: string) =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

const prunePending = () => {
  const now = Date.now();
  for (const [id, action] of pendingActions) {
    if (action.expires_at < now) pendingActions.delete(id);
  }
};

const extractText = (
  content: AnthropicMessage["content"] | AnthropicContentBlock[],
): string => {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
};

const canUseAssistant = (member: AssistantMember) => {
  if (member.administrator === true) return true;
  if (hasMemberCapability(member, "crm.assistant.use")) return true;
  return (
    hasMemberCapability(member, "crm.contacts.view") ||
    hasMemberCapability(member, "support.tickets.view") ||
    hasMemberCapability(member, "crm.pipeline.view") ||
    hasMemberCapability(member, "crm")
  );
};

const loadOrgAssistantSettings = async (orgId: number) => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("assistant_settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeAssistantSettings(data?.assistant_settings);
};

const anthropicStatus = () => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim() ?? "";
  const model =
    Deno.env.get("ANTHROPIC_MODEL")?.trim() || "claude-sonnet-4-6";
  return {
    anthropic_configured: apiKey.length > 0,
    model,
  };
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) return createErrorResponse(401, "Unauthorized");

      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const memberRow = await getUserOrganizationMember(user);
        if (!memberRow?.id || memberRow.org_id == null) {
          return createErrorResponse(403, "Organization not found");
        }

        const member: AssistantMember = {
          id: Number(memberRow.id),
          org_id: Number(memberRow.org_id),
          user_id: String(memberRow.user_id),
          administrator: memberRow.administrator === true,
          module_permissions: memberRow.module_permissions,
          first_name: memberRow.first_name,
          last_name: memberRow.last_name,
          email: memberRow.email,
        };

        const body = (await req.json()) as RequestBody;
        const action = body.action ?? "chat";

        if (action === "status" || action === "update_settings") {
          if (member.administrator !== true) {
            return createErrorResponse(403, "Administrators only");
          }

          if (action === "status") {
            const settings = await loadOrgAssistantSettings(member.org_id);
            const anthropic = anthropicStatus();
            return new Response(
              JSON.stringify({
                enabled: settings.enabled,
                ...anthropic,
                ready: settings.enabled && anthropic.anthropic_configured,
              }),
              {
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }

          const next = normalizeAssistantSettings({
            enabled: body.enabled !== false,
          });
          const { error: updateError } = await supabaseAdmin
            .from("organizations")
            .update({ assistant_settings: next })
            .eq("id", member.org_id);
          if (updateError) {
            throw new Error(updateError.message);
          }

          const anthropic = anthropicStatus();
          return new Response(
            JSON.stringify({
              enabled: next.enabled,
              ...anthropic,
              ready: next.enabled && anthropic.anthropic_configured,
            }),
            {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }

        if (!canUseAssistant(member)) {
          return createErrorResponse(403, "Ask Sigma is not enabled for your role");
        }

        const orgSettings = await loadOrgAssistantSettings(member.org_id);
        if (!orgSettings.enabled) {
          return createErrorResponse(
            403,
            "Ask Sigma is disabled for this workspace. Enable it in Settings → Integrations → Ask Sigma.",
          );
        }

        const supabase = createUserClient(authHeader);
        prunePending();

        if (action === "list_conversations") {
          const { data, error } = await supabase
            .from("assistant_conversations")
            .select("id, title, created_at, updated_at")
            .eq("member_id", member.id)
            .order("updated_at", { ascending: false })
            .limit(40);
          if (error) throw new Error(error.message);
          return new Response(JSON.stringify({ conversations: data ?? [] }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }

        if (action === "get_conversation") {
          const conversationId = Number(body.conversation_id);
          if (!Number.isFinite(conversationId)) {
            return createErrorResponse(400, "conversation_id is required");
          }
          const { data: existing } = await supabase
            .from("assistant_conversations")
            .select("id, title, created_at, updated_at")
            .eq("id", conversationId)
            .eq("member_id", member.id)
            .maybeSingle();
          if (!existing) {
            return createErrorResponse(404, "Conversation not found");
          }
          const { data: rows, error } = await supabase
            .from("assistant_messages")
            .select("id, role, content, created_at")
            .eq("conversation_id", conversationId)
            .in("role", ["user", "assistant"])
            .order("created_at", { ascending: true })
            .limit(MAX_HISTORY_MESSAGES);
          if (error) throw new Error(error.message);
          return new Response(
            JSON.stringify({
              conversation: existing,
              messages: rows ?? [],
            }),
            {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }

        if (!anthropicStatus().anthropic_configured) {
          return createErrorResponse(
            503,
            "Ask Sigma is not configured. Set ANTHROPIC_API_KEY in Edge Function secrets.",
          );
        }

        // Confirm path: execute pending mutation (or batch) without Claude loop
        if (body.confirm_action_id) {
          const pending = pendingActions.get(body.confirm_action_id);
          if (
            !pending ||
            pending.member_id !== member.id ||
            pending.org_id !== member.org_id
          ) {
            return createErrorResponse(404, "Pending action not found or expired");
          }

          const ctx: ToolContext = {
            supabase,
            user,
            member,
            orgId: member.org_id,
            authHeader,
            confirmMode: true,
            registerPendingAction: () => {
              throw new Error("Unexpected pending registration in confirm mode");
            },
          };

          const executed = await executePendingAction(ctx, pending);
          pendingActions.delete(body.confirm_action_id);

          const assistantText = sanitizeAssistantReply(executed.reply);

          await supabase.from("assistant_messages").insert({
            conversation_id: pending.conversation_id,
            org_id: member.org_id,
            member_id: member.id,
            role: "assistant",
            content: assistantText,
            tool_name: pending.tool,
            tool_payload: { confirm_result: executed, pending },
          });

          return new Response(
            JSON.stringify({
              conversation_id: pending.conversation_id,
              reply: assistantText,
              navigate: executed.navigate ?? null,
              confirm_actions: [],
              tool_calls: executed.results.map((result, i) => ({
                name: pending.steps?.[i]?.tool ?? pending.tool,
                result,
              })),
            }),
            {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }

        const message = String(body.message ?? "").trim();
        if (!message) {
          return createErrorResponse(400, "message is required");
        }

        const rate = await assertAssistantRateLimit({
          supabase,
          memberId: member.id,
        });
        if (!rate.ok) {
          return createErrorResponse(429, rate.message);
        }

        let conversationId =
          body.conversation_id != null ? Number(body.conversation_id) : null;

        if (conversationId != null) {
          const { data: existing } = await supabase
            .from("assistant_conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("member_id", member.id)
            .maybeSingle();
          if (!existing) {
            return createErrorResponse(404, "Conversation not found");
          }
        } else {
          const title =
            message.length > 60 ? `${message.slice(0, 57)}…` : message;
          const { data: created, error: createError } = await supabase
            .from("assistant_conversations")
            .insert({
              org_id: member.org_id,
              member_id: member.id,
              title,
            })
            .select("id")
            .single();
          if (createError || !created) {
            throw new Error(createError?.message ?? "Could not create conversation");
          }
          conversationId = Number(created.id);
        }

        await supabase.from("assistant_messages").insert({
          conversation_id: conversationId,
          org_id: member.org_id,
          member_id: member.id,
          role: "user",
          content: message,
        });

        const { data: historyRows } = await supabase
          .from("assistant_messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: true })
          .limit(MAX_HISTORY_MESSAGES);

        const messages: AnthropicMessage[] = (historyRows ?? [])
          .filter((row) => row.content?.trim())
          .map((row) => ({
            role: row.role === "assistant" ? "assistant" : "user",
            content: row.content,
          }));

        const confirmActions: PendingAction[] = [];
        let navigate: string | null = null;
        const toolCallLog: Array<{ name: string; result: unknown }> = [];

        const registerPendingAction = (
          action: Omit<PendingAction, "id" | "created_at">,
        ): PendingAction => {
          const id = crypto.randomUUID();
          const pending: PendingAction = {
            id,
            tool: action.tool,
            input: action.input,
            summary: action.summary,
            created_at: new Date().toISOString(),
            steps: action.steps,
          };
          pendingActions.set(id, {
            ...pending,
            member_id: member.id,
            org_id: member.org_id,
            conversation_id: conversationId!,
            expires_at: Date.now() + PENDING_TTL_MS,
          });
          confirmActions.push(pending);
          return pending;
        };

        const ctx: ToolContext = {
          supabase,
          user,
          member,
          orgId: member.org_id,
          authHeader,
          confirmMode: false,
          registerPendingAction,
        };

        let rounds = 0;
        let finalText = "";

        while (rounds < MAX_TOOL_ROUNDS) {
          rounds += 1;
          const response = await callAnthropicMessages({
            system: CRM_ASSISTANT_SYSTEM_PROMPT,
            messages,
            tools: toAnthropicToolDefs(),
          });

          const toolUses = response.content.filter(
            (b) => b.type === "tool_use",
          ) as Array<{
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          }>;

          messages.push({
            role: "assistant",
            content: response.content as AnthropicContentBlock[],
          });

          if (!toolUses.length) {
            finalText = sanitizeAssistantReply(
              extractText(response.content) || "Done.",
            );
            break;
          }

          const toolResults: AnthropicContentBlock[] = [];
          for (const use of toolUses) {
            const result = await runAssistantTool(
              ctx,
              use.name,
              (use.input ?? {}) as Record<string, unknown>,
            );
            toolCallLog.push({ name: use.name, result });
            if (result.navigate) navigate = result.navigate;

            await supabase.from("assistant_messages").insert({
              conversation_id: conversationId,
              org_id: member.org_id,
              member_id: member.id,
              role: "tool",
              content: JSON.stringify(result).slice(0, 8000),
              tool_name: use.name,
              tool_payload: { input: use.input, result },
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: JSON.stringify(result).slice(0, 12000),
              is_error: !result.ok,
            });
          }

          messages.push({ role: "user", content: toolResults });

          if (response.stop_reason === "end_turn" && !toolUses.length) {
            finalText = extractText(response.content) || "Done.";
            break;
          }
        }

        if (!finalText) {
          finalText =
            confirmActions.length > 0
              ? confirmActions.length === 1
                ? `Ready when you are: ${confirmActions[0]!.summary}. Confirm in the panel to apply.`
                : "Ready when you are. Confirm each pending action in the panel to apply."
              : "I reached the tool step limit. Try a more specific question.";
        }

        finalText = sanitizeAssistantReply(finalText);

        await supabase.from("assistant_messages").insert({
          conversation_id: conversationId,
          org_id: member.org_id,
          member_id: member.id,
          role: "assistant",
          content: finalText,
        });

        await supabase
          .from("assistant_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        return new Response(
          JSON.stringify({
            conversation_id: conversationId,
            reply: finalText,
            navigate,
            confirm_actions: confirmActions,
            tool_calls: toolCallLog.map((t) => ({
              name: t.name,
              ok: (t.result as { ok?: boolean })?.ok ?? null,
            })),
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Assistant request failed";
        console.error("crm_assistant error", message);
        const status =
          message.includes("ANTHROPIC_API_KEY") ||
          message.includes("Anthropic API error")
            ? 502
            : 500;
        return createErrorResponse(status, message);
      }
    });
  }),
);
