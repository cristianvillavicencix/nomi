import { useEffect, useRef, useState } from "react";
import {
  ListBullets,
  ListNumbers,
  TextB,
  TextItalic,
  TextUnderline,
} from "@phosphor-icons/react";
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
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sendable = accounts.filter((a) => a.status === "connected");
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccountId(String(replyTo?.account_id ?? sendable[0]?.id ?? ""));
    setTo(initialTo);
    setCc(initialCc);
    setShowCc(Boolean(initialCc));
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

  const parseList = (raw: string) =>
    raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const title =
    mode === "forward"
      ? "Forward"
      : mode === "reply_all"
        ? "Reply all"
        : mode === "reply"
          ? "Reply"
          : "New message";

  const handleSend = async (asDraft = false) => {
    const id = Number(accountId);
    const bodyHtml = editorRef.current?.innerHTML?.trim() || "<p></p>";
    if (!id || (!asDraft && !to.trim())) {
      notify("Choose a From account and at least one recipient", {
        type: "warning",
      });
      return;
    }
    setPending(true);
    try {
      await sendMailMessage({
        account_id: id,
        to: parseList(to),
        cc: parseList(cc),
        subject,
        body_html: bodyHtml,
        thread_id: mode === "forward" ? undefined : replyTo?.id,
        save_draft: asDraft,
      });
      notify(asDraft ? "Draft saved" : "Message sent", { type: "success" });
      onOpenChange(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Send failed", { type: "error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
            <Label className="text-muted-foreground">From</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-8">
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
          <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
            <Label htmlFor="mail-to" className="text-muted-foreground">
              To
            </Label>
            <div className="flex gap-2">
              <Input
                id="mail-to"
                className="h-8"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@example.com"
              />
              {!showCc ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              ) : null}
            </div>
          </div>
          {showCc ? (
            <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
              <Label htmlFor="mail-cc" className="text-muted-foreground">
                Cc
              </Label>
              <Input
                id="mail-cc"
                className="h-8"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="optional"
              />
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[4.5rem_1fr] sm:items-center">
            <Label htmlFor="mail-subject" className="text-muted-foreground">
              Subject
            </Label>
            <Input
              id="mail-subject"
              className="h-8"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>

        <div className="border-y">
          <div className="flex items-center gap-0.5 px-2 py-1">
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
              "mail-compose-editor min-h-[180px] max-h-[360px] overflow-y-auto px-4 py-3 text-sm outline-none",
              "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
              "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            )}
          />
        </div>

        <DialogFooter className="px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
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
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
