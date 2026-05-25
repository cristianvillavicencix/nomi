import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, Send, X } from "lucide-react";
import { useGetIdentity, useNotify, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Contact, Conversation, ConversationMessage } from "@/lbs/types";
import { SmsWebFormPicker } from "@/lbs/messages/SmsWebFormPicker";
import { cn } from "@/lib/utils";
import {
  isImageMediaUrl,
  getMediaFileName,
  downloadMediaUrl,
  uploadSmsMedia,
} from "@/lbs/messages/smsMediaUpload";
import { useResolvedMediaUrl } from "@/lbs/messages/useResolvedMediaUrl";
import { InternalNoteToggle } from "@/lbs/messages/composer/InternalNoteToggle";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useOrganizationSmsSignature } from "@/lbs/settings/useOrganizationSmsSignature";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

export const ClientSmsComposer = ({
  contact,
  dealId,
  conversationId,
  replyToMessageId,
  onSent,
  disabled,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  conversationId?: Identifier | null;
  replyToMessageId?: Identifier | null;
  onSent?: (result: {
    conversation: Conversation;
    message: ConversationMessage;
  }) => void;
  disabled?: boolean;
}) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const sendClientSms = useSendClientSms();
  const { signature, settings: orgSignatureSettings } =
    useOrganizationSmsSignature();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(
    orgSignatureSettings?.sms_signature_enabled ?? true,
  );
  const canWriteInternalNotes = useMemberCapability(
    "messaging.internal_notes.write",
  );

  useEffect(() => {
    if (orgSignatureSettings?.sms_signature_enabled != null) {
      setIncludeSignature(orgSignatureSettings.sms_signature_enabled);
    }
  }, [orgSignatureSettings?.sms_signature_enabled]);

  const canSend =
    !disabled &&
    !isSending &&
    (body.trim().length > 0 || pendingFiles.length > 0) &&
    (conversationId != null || contact?.id != null);

  if (disabled) {
    return (
      <div className="border-t border-border/40 px-4 py-4 bg-background">
        <p className="text-center text-sm text-muted-foreground">
          You don&apos;t have permission to send messages. Ask an administrator
          to enable <span className="text-foreground">Send messages</span> in
          Settings → Users.
        </p>
      </div>
    );
  }

  const addPendingFile = (file: File) => {
    const id = crypto.randomUUID();
    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
    setPendingFiles((current) => [...current, { id, file, previewUrl }]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const insertFormLink = (url: string, label: string) => {
    const snippet = `${label}: ${url}`;
    setBody((current) =>
      current.trim() ? `${current.trim()}\n${snippet}` : snippet,
    );
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach(addPendingFile);
  };

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const uploadedUrls: string[] = [];
      for (const pending of pendingFiles) {
        uploadedUrls.push(await uploadSmsMedia(pending.file, identity?.org_id));
      }

      let finalBody = body.trim();
      if (
        !isInternalNote &&
        includeSignature &&
        signature &&
        finalBody.length > 0
      ) {
        finalBody = `${finalBody}\n${signature}`;
      }

      const result = await sendClientSms({
        conversationId: conversationId ?? undefined,
        contactId: contact?.id,
        dealId,
        body: finalBody,
        mediaUrls: uploadedUrls,
        isInternalNote,
        replyToMessageId,
      });

      if (!result.conversation || !result.message) {
        throw new Error("Failed to send SMS");
      }

      pendingFiles.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      setBody("");
      setPendingFiles([]);
      onSent?.({
        conversation: result.conversation,
        message: result.message,
      });
      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to send SMS", {
        type: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-2 border-t border-border/40 px-4 pt-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] bg-background",
        isInternalNote && "bg-amber-50/40 dark:bg-amber-500/5",
      )}
    >
      {canWriteInternalNotes ? (
        <InternalNoteToggle
          checked={isInternalNote}
          onCheckedChange={setIsInternalNote}
          disabled={disabled || isSending}
        />
      ) : null}
      {!isInternalNote && signature ? (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Switch
            id="signature-toggle"
            checked={includeSignature}
            onCheckedChange={setIncludeSignature}
            disabled={disabled || isSending}
          />
          <label htmlFor="signature-toggle" className="cursor-pointer">
            Include signature{includeSignature ? `: "${signature}"` : ""}
          </label>
        </div>
      ) : null}
      {pendingFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((pending) => (
            <div
              key={pending.id}
              className="relative flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5 text-xs"
            >
              {pending.previewUrl ? (
                <img
                  src={pending.previewUrl}
                  alt=""
                  className="size-10 rounded object-cover"
                />
              ) : (
                <Paperclip className="size-4 text-muted-foreground" />
              )}
              <span className="max-w-[140px] truncate">
                {pending.file.name}
              </span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => removePendingFile(pending.id)}
                aria-label="Remove attachment"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-[1.35rem] border border-border/60 bg-muted/25 px-2 py-2 pr-3 dark:bg-muted/20">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx"
          multiple
          onChange={(event) => {
            const files = event.target.files;
            if (!files) return;
            Array.from(files).forEach(addPendingFile);
            event.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled || isSending}
          aria-label="Attach file or photo"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>

        <SmsWebFormPicker
          contact={contact}
          dealId={dealId}
          onInsertLink={insertFormLink}
          disabled={disabled || isSending}
        />

        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={handlePaste}
          placeholder="Write an SMS… paste text, photos, or form links"
          className="min-h-[44px] max-h-32 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none field-sizing-fixed focus-visible:ring-0"
          rows={1}
          disabled={disabled || isSending}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />

        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={!canSend}
          aria-label={isInternalNote ? "Add internal note" : "Send SMS"}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </form>
  );
};

export const SmsMessageMedia = ({
  url,
  alt,
}: {
  url: string;
  alt?: string;
}) => {
  const resolvedUrl = useResolvedMediaUrl(url);
  const fileName = getMediaFileName(url);
  const isImage = isImageMediaUrl(url);

  if (!resolvedUrl) {
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        Loading attachment…
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      {isImage ? (
        <img
          src={resolvedUrl}
          alt={alt ?? fileName}
          className="max-h-48 rounded-lg object-cover"
        />
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-current/10 bg-black/5 px-2.5 py-2 text-xs dark:bg-white/5">
          <Paperclip className="size-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{fileName}</span>
        </div>
      )}
      <Button
        type="button"
        variant={isImage ? "secondary" : "outline"}
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() => void downloadMediaUrl(url)}
      >
        <Download className="size-3.5" />
        Download
      </Button>
    </div>
  );
};
