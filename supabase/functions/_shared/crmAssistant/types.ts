import type { SupabaseClient, User } from "jsr:@supabase/supabase-js@2";

export type AssistantMember = {
  id: number;
  org_id: number;
  user_id: string;
  administrator?: boolean | null;
  module_permissions?: unknown;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export type PendingStep = {
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  /**
   * After this step succeeds, map result paths into the next step's input.
   * Example: { contact_id: "contact.id" }
   */
  bind_next?: Record<string, string>;
};

export type PendingAction = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  created_at: string;
  /** Multi-step confirm (create contact then schedule, etc.). */
  steps?: PendingStep[];
};

export type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Soft confirmation gate — mutation not applied yet. */
  pending_action?: PendingAction;
  /** Client should navigate after the turn. */
  navigate?: string;
};

export type ToolContext = {
  supabase: SupabaseClient;
  user: User;
  member: AssistantMember;
  orgId: number;
  authHeader: string;
  /** Register a pending mutation for UI confirm. */
  registerPendingAction: (
    action: Omit<PendingAction, "id" | "created_at">,
  ) => PendingAction;
  /** When true, mutate tools execute instead of returning pending_action. */
  confirmMode: boolean;
};

export type AssistantTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Capability id(s); any match grants access. Empty = any assistant user. */
  capabilities?: string[];
  /** When true, first call returns pending_action unless confirmMode. */
  requiresConfirm?: boolean;
  execute: (
    ctx: ToolContext,
    input: Record<string, unknown>,
  ) => Promise<ToolResult>;
};

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};
