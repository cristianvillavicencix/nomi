import { hasMemberCapability } from "../memberModulePermissions.ts";
import { getToolByName } from "./toolRegistry.ts";
import type { ToolContext, ToolResult } from "./types.ts";

export async function runAssistantTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (!hasMemberCapability(ctx.member, "crm.assistant.use") &&
    ctx.member.administrator !== true) {
    // Fall through if capability catalog not yet granted: allow when any CRM view exists
    const fallback =
      hasMemberCapability(ctx.member, "crm.contacts.view") ||
      hasMemberCapability(ctx.member, "support.tickets.view") ||
      hasMemberCapability(ctx.member, "crm.pipeline.view");
    if (!fallback && ctx.member.administrator !== true) {
      return {
        ok: false,
        error: "Missing permission: crm.assistant.use",
      };
    }
  }

  const tool = getToolByName(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }

  if (tool.capabilities?.length) {
    const allowed = tool.capabilities.some((cap) =>
      hasMemberCapability(ctx.member, cap),
    );
    if (!allowed) {
      return {
        ok: false,
        error: `Missing permission: ${tool.capabilities.join(" or ")}`,
      };
    }
  }

  try {
    return await tool.execute(ctx, input ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool failed";
    return { ok: false, error: message };
  }
}
