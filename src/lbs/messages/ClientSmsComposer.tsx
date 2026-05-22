import { useRef, useState } from "react";
import { Download, Paperclip, Send, X } from "lucide-react";
import { useNotify, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Contact, Conversation, ConversationMessage } from "@/lbs/types";
import { SmsWebFormPicker } from "@/lbs/messages/SmsWebFormPicker";
import { isImageMediaUrl, getMediaFileName, downloadMediaUrl, uploadSmsMedia } from "@/lbs/messages/smsMediaUpload";
import { useSendClientSms } from "@/lbs/messages/useClientSms";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

export const ClientSmsComposer = ({
  contact,
  dealId,
  conversationId,
  onSent,
  disabled,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  conversationId?: Identifier | null;
  onSent?: (result: {
    conversation: Conversation;
    message: ConversationMessage;
  }) => void;
  disabled?: boolean;
}) => {
  const notify = useNotify();
  const sendClientSms = useSendClientSms();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);

  const canSend =
    !disabled &&
    !isSending &&
    (body.trim().length > 0 || pendingFiles.length > 0) &&
    (conversationId != null || contact?.id != null);

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
    setBody((current) => (current.trim() ? `${current.trim()}\n${snippet}` : snippet));
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
        uploadedUrls.push(await uploadSmsMedia(pending.file));
      }

      const result = await sendClientSms({
        conversationId: conversationId ?? undefined,
        contactId: contact?.id,
        dealId,
        body: body.trim(),
        mediaUrls: uploadedUrls,
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
    <form onSubmit={handleSubmit} className="space-y-2 border-t bg-background px-3 py-3">
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
              <span className="max-w-[140px] truncate">{pending.file.name}</span>
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

      <div className="flex items-end gap-2">
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
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={handlePaste}
          placeholder="Write an SMS… paste text, photos, or form links"
          className="min-h-[44px] max-h-32 resize-none rounded-2xl bg-muted/40 px-4 py-3"
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
          aria-label="Send SMS"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </form>
  );
};

export const SmsMessageMedia = ({ url, alt }: { url: string; alt?: string }) => {
  const fileName = getMediaFileName(url);
  const isImage = isImageMediaUrl(url);

  return (
    <div className="mt-1 space-y-2">
      {isImage ? (
        <img
          src={url}
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
