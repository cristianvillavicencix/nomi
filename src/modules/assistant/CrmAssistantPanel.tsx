import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { History, Loader2, MessageSquarePlus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import type {
  AssistantConfirmAction,
  useCrmAssistant,
} from "./useCrmAssistant";

type AssistantApi = ReturnType<typeof useCrmAssistant>;

type CrmAssistantPanelProps = {
  assistant: AssistantApi;
};

const formatHistoryTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const ConfirmCard = ({
  action,
  sending,
  onConfirm,
  onCancel,
}: {
  action: AssistantConfirmAction;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const stepLines =
    action.steps?.map((s) => s.summary).filter(Boolean) ??
    (action.summary ? [action.summary] : []);

  return (
    <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
      <p className="text-xs font-medium text-foreground">{action.summary}</p>
      {stepLines.length > 1 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {stepLines.map((line) => (
            <li key={line}>- {line}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={sending}
          onClick={onConfirm}
        >
          Confirm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={sending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export function CrmAssistantPanel({ assistant }: CrmAssistantPanelProps) {
  const {
    open,
    setOpen,
    messages,
    sending,
    error,
    lastNavigate,
    clearNavigate,
    sendMessage,
    confirmAction,
    cancelAction,
    startNewChat,
    loadHistory,
    openConversation,
    conversations,
    historyLoading,
    conversationId,
  } = assistant;

  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!lastNavigate) return;
    navigate(lastNavigate);
    clearNavigate();
    setOpen(false);
  }, [lastNavigate, navigate, clearNavigate, setOpen]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft;
    setDraft("");
    await sendMessage(text);
  };

  const handleHistoryOpenChange = (next: boolean) => {
    setHistoryOpen(next);
    if (next) void loadHistory();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="space-y-3 border-b px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 shrink-0" />
                Ask Sigma
              </SheetTitle>
              <SheetDescription className="mt-1">
                Search your CRM and take actions. Changes require confirmation.
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={sending}
              onClick={() => {
                startNewChat();
                setDraft("");
              }}
            >
              <MessageSquarePlus className="size-3.5" />
              New chat
            </Button>
            <DropdownMenu
              open={historyOpen}
              onOpenChange={handleHistoryOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={sending}
                >
                  <History className="size-3.5" />
                  History
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {historyLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No previous chats yet.
                  </p>
                ) : (
                  conversations.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      className={cn(
                        "flex flex-col items-start gap-0.5 py-2",
                        conversationId === item.id && "bg-accent",
                      )}
                      onSelect={() => {
                        void openConversation(item.id);
                      }}
                    >
                      <span className="line-clamp-2 w-full text-sm">
                        {item.title?.trim() || "Untitled chat"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatHistoryTime(item.updated_at)}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Example: Meeting Monday at 11 with Salvador — create the contact
                if missing.
              </p>
            ) : null}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "ml-6 bg-primary text-primary-foreground"
                    : msg.role === "system"
                      ? "border border-dashed text-muted-foreground"
                      : "mr-6 bg-muted",
                )}
              >
                {msg.content}
                {msg.confirmActions?.map((action) => (
                  <ConfirmCard
                    key={action.id}
                    action={action}
                    sending={sending}
                    onConfirm={() => void confirmAction(action.id)}
                    onCancel={() => cancelAction(action.id)}
                  />
                ))}
              </div>
            ))}
            {sending ? (
              <div className="mr-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Working…
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="border-t p-3"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask or request an action…"
            rows={3}
            disabled={sending}
            className="mb-2 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e);
              }
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !draft.trim()}>
              Send
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
