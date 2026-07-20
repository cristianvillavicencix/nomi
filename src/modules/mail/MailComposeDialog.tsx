import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ListBullets,
  ListNumbers,
  PaperPlaneTilt,
  TextB,
  TextItalic,
  TextUnderline,
  X,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { sendMailMessage } from "./mailApi";
import type { MailAccount, MailThread } from "./types";

export type MailComposeMode = "new" | "reply" | "reply_all" | "forward";

function exec(cmd: string) {
  document.execCommand(cmd, false);
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function RecipientChips({
  id,
  label,
  emails,
  onChange,
  trailing,
  placeholder = "name@example.com",
}: {
  id: string;
  label: string;
  emails: string[];
  onChange: (next: string[]) => void;
  trailing?: ReactNode;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (value: string) => {
    const next = parseEmails(value);
    if (next.length === 0) return;
    const merged = [...emails];
    for (const email of next) {
      if (!merged.some((e) => e.toLowerCase() === email.toLowerCase())) {
        merged.push(email);
      }
    }
    onChange(merged);
    setDraft("");
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-start">
      <Label htmlFor={id} className="pt-2 text-muted-foreground">
        {label}
      </Label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            <span className="truncate">{email}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Remove ${email}`}
              onClick={() =>
                onChange(emails.filter((e) => e !== email))
              }
            >
              <X className="size-3" weight="bold" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={draft}
          placeholder={emails.length === 0 ? placeholder : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && emails.length) {
              onChange(emails.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
        />
        {trailing}
      </div>
    </div>
  );
}

export function MailComposeDialog({
  open,
  onOpenChange,
  accounts,
  replyTo,
  mode = "new",
  initialTo = "",
  initialCc = "",
  initialSubject = "",
  initialBody = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MailAccount[];
  replyTo: MailThread | null;
  mode?: MailComposeMode;
  initialTo?: string;
  initialCc?: string;
  initialSubject?: string;
  initialBody?: string;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sendable = accounts.filter((a) => a.status === "connected");
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccountId(String(replyTo?.account_id ?? sendable[0]?.id ?? ""));
    setTo(parseEmails(initialTo));
    setCc(parseEmails(initialCc));
    setBcc([]);
    setShowCc(Boolean(initialCc));
    setShowBcc(false);
    if (initialSubject) {
      setSubject(initialSubject);
    } else if (replyTo?.subject) {
      const base = replyTo.subject.replace(/^(Re|Fwd):\s*/i, "");
      setSubject(mode === "forward" ? `Fwd: ${base}` : `Re: ${base}`);
    } else {
      setSubject("");
    }
    const html = initialBody
      ? initialBody.includes("<")
        ? initialBody
        : `<p>${initialBody.replace(/\n/g, "<br/>")}</p>`
      : "<p><br></p>";
    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = html;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyTo?.id, mode, initialTo, initialCc, initialSubject, initialBody]);

  const title =
    mode === "forward"
      ? "Forward"
      : mode === "reply_all"
        ? "Reply all"
        : mode === "reply"
          ? "Reply"
          : "New email";

  const handleSend = async (asDraft = false) => {
    const id = Number(accountId);
    const bodyHtml = editorRef.current?.innerHTML?.trim() || "<p></p>";
    if (!id || (!asDraft && to.length === 0)) {
      notify("Choose a From account and at least one recipient", {
        type: "warning",
      });
      return;
    }
    setPending(true);
    try {
      await sendMailMessage({
        account_id: id,
        to,
        cc,
        bcc: bcc.length ? bcc : undefined,
        subject,
        body_html: bodyHtml,
        thread_id: mode === "forward" ? undefined : replyTo?.id,
        save_draft: asDraft,
      });
      notify(asDraft ? "Draft saved" : "Message sent", { type: "success" });
      void queryClient.invalidateQueries({ queryKey: ["mail_threads"] });
      void queryClient.invalidateQueries({ queryKey: ["mail_messages"] });
      void queryClient.invalidateQueries({ queryKey: ["mail_unread_count"] });
      onOpenChange(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Send failed", { type: "error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
            <Label className="text-muted-foreground">From</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select mailbox" />
              </SelectTrigger>
              <SelectContent>
                {sendable.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RecipientChips
            id="mail-to"
            label="To"
            emails={to}
            onChange={setTo}
            trailing={
              <div className="ml-auto flex shrink-0 gap-1">
                {!showCc ? (
                  <button
                    type="button"
                    className="px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCc(true)}
                  >
                    Cc
                  </button>
                ) : null}
                {!showBcc ? (
                  <button
                    type="button"
                    className="px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setShowBcc(true)}
                  >
                    Bcc
                  </button>
                ) : null}
              </div>
            }
          />

          {showCc ? (
            <RecipientChips
              id="mail-cc"
              label="Cc"
              emails={cc}
              onChange={setCc}
              placeholder="optional"
            />
          ) : null}
          {showBcc ? (
            <RecipientChips
              id="mail-bcc"
              label="Bcc"
              emails={bcc}
              onChange={setBcc}
              placeholder="optional"
            />
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
            <Label htmlFor="mail-subject" className="text-muted-foreground">
              Subject
            </Label>
            <Input
              id="mail-subject"
              className="h-9 border-0 border-b px-0 font-medium shadow-none focus-visible:ring-0"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
        </div>

        <div className="border-t">
          <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
            <IconButton
              aria-label="Bold"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("bold");
              }}
            >
              <TextB className="size-4" />
            </IconButton>
            <IconButton
              aria-label="Italic"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("italic");
              }}
            >
              <TextItalic className="size-4" />
            </IconButton>
            <IconButton
              aria-label="Underline"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("underline");
              }}
            >
              <TextUnderline className="size-4" />
            </IconButton>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <IconButton
              aria-label="Bullet list"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("insertUnorderedList");
              }}
            >
              <ListBullets className="size-4" />
            </IconButton>
            <IconButton
              aria-label="Numbered list"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("insertOrderedList");
              }}
            >
              <ListNumbers className="size-4" />
            </IconButton>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            className={cn(
              "mail-compose-editor min-h-[220px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none",
              "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
              "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            )}
          />
        </div>

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSend(true)}
              disabled={pending}
            >
              Save draft
            </Button>
            <Button
              type="button"
              onClick={() => void handleSend(false)}
              disabled={pending}
            >
              <PaperPlaneTilt className="size-4" weight="fill" />
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
