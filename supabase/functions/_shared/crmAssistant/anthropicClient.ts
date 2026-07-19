import type {
  AnthropicMessage,
  AnthropicToolDef,
} from "./types.ts";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export type AnthropicMessagesResponse = {
  id: string;
  stop_reason: string | null;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
};

export async function callAnthropicMessages(params: {
  system: string;
  messages: AnthropicMessage[];
  tools: AnthropicToolDef[];
  maxTokens?: number;
}): Promise<AnthropicMessagesResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = Deno.env.get("ANTHROPIC_MODEL")?.trim() || DEFAULT_MODEL;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tools.length ? { type: "auto" } : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 500)}`);
  }

  return (await res.json()) as AnthropicMessagesResponse;
}
