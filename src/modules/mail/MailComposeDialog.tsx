import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  File,
  FilePdf,
  ListBullets,
  ListNumbers,
  Paperclip,
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

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

type ComposeAttachment = {
  id: string;
  filename: string;
  content_type: string;
  content_base64: string;
  size_bytes: number;
};

function exec(cmd: string) {
  document.execCommand(cmd, false);
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function AttachmentIcon({ mime, filename }: { mime: string; filename: string }) {
  const lower = filename.toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    return <FilePdf className="size-5 text-red-600" weight="fill" />;
  }
  return <File className="size-5 text-muted-foreground" weight="fill" />;
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
              onClick={() => onChange(emails.filter((e) => e !== email))}
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

function FormatToolbar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border bg-background px-1 py-0.5 shadow-md",
        className,
      )}
    >
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
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sendable = accounts.filter((a) => a.status === "connected");
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [pending, setPending] = useState(false);
  const [formatPos, setFormatPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccountId(String(replyTo?.account_id ?? sendable[0]?.id ?? ""));
    setTo(parseEmails(initialTo));
    setCc(parseEmails(initialCc));
    setBcc([]);
    setShowCc(Boolean(initialCc));
    setShowBcc(false);
    setAttachments([]);
    setFormatPos(null);
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

  const updateFormatToolbar = useCallback(() => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    const shell = editorShellRef.current;
    if (!sel || !editor || !shell || sel.isCollapsed || sel.rangeCount === 0) {
      setFormatPos(null);
      return;
    }
    const anchor = sel.anchorNode;
    if (!anchor || !editor.contains(anchor)) {
      setFormatPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setFormatPos(null);
      return;
    }
    setFormatPos({
      top: Math.max(8, rect.top - shellRect.top - 44),
      left: Math.min(
        Math.max(8, rect.left - shellRect.left + rect.width / 2 - 90),
        shellRect.width - 200,
      ),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onSel = () => updateFormatToolbar();
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [open, updateFormatToolbar]);

  const title =
    mode === "forward"
      ? "Forward"
      : mode === "reply_all"
        ? "Reply all"
        : mode === "reply"
          ? "Reply"
          : "New email";

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const next = [...attachments];
    let total = next.reduce((sum, a) => sum + a.size_bytes, 0);
    for (const file of list) {
      if (next.length >= MAX_ATTACHMENTS) {
        notify(`You can attach up to ${MAX_ATTACHMENTS} files`, {
          type: "warning",
        });
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        notify(
          `"${file.name}" exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB`,
          { type: "warning" },
        );
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        notify(
          `Attachments exceed ${MAX_TOTAL_BYTES / (1024 * 1024)} MB total`,
          { type: "warning" },
        );
        break;
      }
      try {
        const content_base64 = await fileToBase64(file);
        next.push({
          id: crypto.randomUUID(),
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          content_base64,
          size_bytes: file.size,
        });
        total += file.size;
      } catch {
        notify(`Could not read "${file.name}"`, { type: "error" });
      }
    }
    setAttachments(next);
  };

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
        attachments: asDraft
          ? undefined
          : attachments.map(({ filename, content_type, content_base64, size_bytes }) => ({
              filename,
              content_type,
              content_base64,
              size_bytes,
            })),
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

        <div ref={editorShellRef} className="relative border-t">
          {formatPos ? (
            <div
              className="pointer-events-auto absolute z-10"
              style={{ top: formatPos.top, left: formatPos.left }}
            >
              <FormatToolbar />
            </div>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            onMouseUp={updateFormatToolbar}
            onKeyUp={updateFormatToolbar}
            className={cn(
              "mail-compose-editor min-h-[220px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none",
              "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
              "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            )}
          />
        </div>

        {attachments.length > 0 ? (
          <div className="space-y-2 border-t px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {attachments.length} attachment
              {attachments.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-2">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <AttachmentIcon
                    mime={file.content_type}
                    filename={file.filename}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size_bytes)}
                    </p>
                  </div>
                  <IconButton
                    aria-label={`Remove ${file.filename}`}
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((a) => a.id !== file.id),
                      )
                    }
                  >
                    <X className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:justify-between">
          <div className="flex items-center gap-1">
            <IconButton
              aria-label="Attach files"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || attachments.length >= MAX_ATTACHMENTS}
            >
              <Paperclip className="size-4" />
            </IconButton>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSend(true)}
              disabled={pending}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-foreground text-background hover:bg-foreground/90"
              onClick={() => void handleSend(false)}
              disabled={pending}
              isLoading={pending}
            >
              <PaperPlaneTilt className="size-4" weight="fill" />
              Send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
