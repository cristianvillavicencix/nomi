import { runAssistantTool } from "./runTool.ts";
import type { PendingAction, ToolContext, ToolResult } from "./types.ts";

const getByPath = (value: unknown, path: string): unknown => {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = value;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
};

/**
 * Execute a single pending action or an ordered batch (create → schedule).
 */
export async function executePendingAction(
  ctx: ToolContext,
  pending: PendingAction,
): Promise<{ ok: boolean; reply: string; navigate?: string; results: ToolResult[] }> {
  const steps =
    pending.tool === "__batch__" && pending.steps?.length
      ? pending.steps
      : [
          {
            tool: pending.tool,
            input: pending.input,
            summary: pending.summary,
          },
        ];

  const results: ToolResult[] = [];
  let navigate: string | undefined;
  const doneSummaries: string[] = [];
  let nextInputPatch: Record<string, unknown> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const input = { ...step.input, ...nextInputPatch };
    const result = await runAssistantTool(ctx, step.tool, input);
    results.push(result);

    if (!result.ok) {
      return {
        ok: false,
        reply: `Could not complete “${step.summary}”: ${result.error ?? "unknown error"}`,
        navigate,
        results,
      };
    }

    doneSummaries.push(step.summary);
    if (result.navigate) navigate = result.navigate;

    nextInputPatch = {};
    if (step.bind_next) {
      for (const [key, path] of Object.entries(step.bind_next)) {
        const bound = getByPath(result.data, path);
        if (bound !== undefined) nextInputPatch[key] = bound;
      }
    }
  }

  const reply =
    doneSummaries.length === 1
      ? `Done: ${doneSummaries[0]}`
      : `Done:\n${doneSummaries.map((s) => `- ${s}`).join("\n")}`;

  return { ok: true, reply, navigate, results };
}
