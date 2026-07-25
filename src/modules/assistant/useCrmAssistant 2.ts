import { useCallback, useState } from "react";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "@/components/atomic-crm/providers/supabase/invokeEdgeFunction";
import { sanitizeAssistantReply } from "@/modules/assistant/sanitizeAssistantReply";

export type AssistantConfirmStep = {
  tool: string;
  input: Record<string, unknown>;
  summary: string;
};

export type AssistantConfirmAction = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  created_at: string;
  steps?: AssistantConfirmStep[];
};

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  confirmActions?: AssistantConfirmAction[];
};

export type AssistantConversationSummary = {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type AssistantResponse = {
  conversation_id: number;
  reply: string;
  navigate?: string | null;
  confirm_actions?: AssistantConfirmAction[];
};

type ListConversationsResponse = {
  conversations: AssistantConversationSummary[];
};

type GetConversationResponse = {
  conversation: AssistantConversationSummary;
  messages: Array<{
    id: number;
    role: string;
    content: string;
    created_at: string;
  }>;
};

export function useCrmAssistant() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<
    AssistantConfirmAction[]
  >([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNavigate, setLastNavigate] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    AssistantConversationSummary[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const reset = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setPendingConfirms([]);
    setError(null);
    setLastNavigate(null);
  }, []);

  const startNewChat = useCallback(() => {
    reset();
  }, [reset]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } =
        await invokeEdgeFunction<ListConversationsResponse>("crm_assistant", {
          method: "POST",
          body: { action: "list_conversations" },
        });
      if (invokeError || !data) {
        const msg = await readEdgeFunctionErrorMessage(
          invokeError ?? {},
          "Could not load chat history",
        );
        setError(msg);
        return;
      }
      setConversations(data.conversations ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load chat history",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openConversation = useCallback(async (id: number) => {
    setSending(true);
    setError(null);
    setPendingConfirms([]);
    setLastNavigate(null);
    try {
      const { data, error: invokeError } =
        await invokeEdgeFunction<GetConversationResponse>("crm_assistant", {
          method: "POST",
          body: { action: "get_conversation", conversation_id: id },
        });
      if (invokeError || !data) {
        const msg = await readEdgeFunctionErrorMessage(
          invokeError ?? {},
          "Could not open conversation",
        );
        setError(msg);
        return;
      }
      setConversationId(Number(data.conversation.id));
      setMessages(
        (data.messages ?? [])
          .filter((row) => row.role === "user" || row.role === "assistant")
          .map((row) => ({
            id: `h-${row.id}`,
            role: row.role as "user" | "assistant",
            content:
              row.role === "assistant"
                ? sanitizeAssistantReply(row.content)
                : row.content,
          })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open conversation",
      );
    } finally {
      setSending(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setError(null);
      const userMsg: AssistantChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const { data, error: invokeError } =
          await invokeEdgeFunction<AssistantResponse>("crm_assistant", {
            method: "POST",
            body: {
              conversation_id: conversationId,
              message: trimmed,
            },
          });

        if (invokeError || !data) {
          const msg = await readEdgeFunctionErrorMessage(
            invokeError ?? {},
            "Ask Sigma could not respond",
          );
          setError(msg);
          setMessages((prev) => [
            ...prev,
            {
              id: `a-err-${Date.now()}`,
              role: "assistant",
              content: msg,
            },
          ]);
          return;
        }

        setConversationId(data.conversation_id);
        const confirms = data.confirm_actions ?? [];
        setPendingConfirms(confirms);
        if (data.navigate) setLastNavigate(data.navigate);

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: sanitizeAssistantReply(data.reply),
            confirmActions: confirms.length ? confirms : undefined,
          },
        ]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Ask Sigma could not respond";
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  const confirmAction = useCallback(
    async (actionId: string) => {
      if (sending) return;
      setSending(true);
      setError(null);
      try {
        const { data, error: invokeError } =
          await invokeEdgeFunction<AssistantResponse>("crm_assistant", {
            method: "POST",
            body: {
              conversation_id: conversationId,
              confirm_action_id: actionId,
            },
          });

        if (invokeError || !data) {
          const msg = await readEdgeFunctionErrorMessage(
            invokeError ?? {},
            "Could not confirm action",
          );
          setError(msg);
          return;
        }

        setPendingConfirms((prev) => prev.filter((a) => a.id !== actionId));
        setMessages((prev) =>
          prev.map((msg) =>
            msg.confirmActions?.some((a) => a.id === actionId)
              ? {
                  ...msg,
                  confirmActions: msg.confirmActions.filter(
                    (a) => a.id !== actionId,
                  ),
                }
              : msg,
          ),
        );
        if (data.navigate) setLastNavigate(data.navigate);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-confirm-${Date.now()}`,
            role: "assistant",
            content: sanitizeAssistantReply(data.reply),
          },
        ]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not confirm action";
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  const cancelAction = useCallback((actionId: string) => {
    setPendingConfirms((prev) => prev.filter((a) => a.id !== actionId));
    setMessages((prev) =>
      prev.map((msg) =>
        msg.confirmActions?.some((a) => a.id === actionId)
          ? {
              ...msg,
              confirmActions: msg.confirmActions.filter((a) => a.id !== actionId),
            }
          : msg,
      ),
    );
  }, []);

  const clearNavigate = useCallback(() => setLastNavigate(null), []);

  return {
    open,
    setOpen,
    messages,
    pendingConfirms,
    sending,
    error,
    lastNavigate,
    clearNavigate,
    sendMessage,
    confirmAction,
    cancelAction,
    reset,
    startNewChat,
    loadHistory,
    openConversation,
    conversations,
    historyLoading,
    conversationId,
  };
}
