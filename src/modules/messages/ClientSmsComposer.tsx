import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { useGetIdentity, useNotify, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { Contact, Conversation, ConversationMessage } from "@/modules/types";
import { cn } from "@/lib/utils";
import { uploadSmsMedia } from "@/modules/messages/smsMediaUpload";
import { SmsComposerActionsMenu } from "@/modules/messages/composer/SmsComposerActionsMenu";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { ClientSmsPhoneField } from "@/modules/messages/ClientSmsPhoneField";
import { resolveClientSmsPhone } from "@/modules/messages/messageContactUtils";
import {
  formatUsPhoneDisplayFromAny,
  normalizeUsPhoneToE164,
} from "@/utils/phone";
import { useOrganizationSmsSignature } from "@/modules/settings/useOrganizationSmsSignature";
import { SmsTemplateShortcutTiles } from "@/modules/messages/SmsTemplateShortcutTiles";

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
  prefillRequest,
  compact = false,
  externalPhone,
  onExternalPhoneChange,
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
  prefillRequest?: { key: number; text: string } | null;
  compact?: boolean;
  externalPhone?: string | null;
  onExternalPhoneChange?: (e164: string) => void;
}) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const sendClientSms = useSendClientSms();
  const { signature, settings: orgSignatureSettings, signatureContext } =
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
  const signatureDefaultApplied = useRef(false);
  const canWriteInternalNotes = useMemberCapability(
    "messaging.internal_notes.write",
  );

  useEffect(() => {
    if (signatureDefaultApplied.current) return;
    if (orgSignatureSettings?.sms_signature_enabled == null) return;
    setIncludeSignature(orgSignatureSettings.sms_signature_enabled);
    signatureDefaultApplied.current = true;
  }, [orgSignatureSettings?.sms_signature_enabled]);

  const textareaMaxHeightPx = compact ? 144 : 208;

  const syncTextareaHeight = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, textareaMaxHeightPx)}px`;
  };

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [body, compact, textareaMaxHeightPx]);

  useEffect(() => {
    if (!prefillRequest?.text) return;
    setBody(prefillRequest.text);
    window.requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      const length = prefillRequest.text.length;
      node.setSelectionRange(length, length);
      syncTextareaHeight();
    });
  }, [prefillRequest?.key, prefillRequest?.text]);

  const resolvedExternalPhone = contact
    ? resolveClientSmsPhone(contact, externalPhone)
    : externalPhone
      ? normalizeUsPhoneToE164(externalPhone)
      : null;

  const canSend =
    !disabled &&
    !isSending &&
    (body.trim().length > 0 || pendingFiles.length > 0) &&
    (conversationId != null || resolvedExternalPhone != null);

  if (disabled) {
    return (
      <div className="bg-background px-4 py-4">
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
    setBody((current) => {
      const trimmed = current.replace(/\/form\s*$/i, "").trimEnd();
      return trimmed ? `${trimmed}\n${snippet}` : snippet;
    });
  };

  const insertTemplateBody = (text: string) => {
    setBody((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${text}` : text;
    });
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      syncTextareaHeight();
    });
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
        externalPhone: resolvedExternalPhone ?? undefined,
      });

      if (!result.conversation || !result.message) {
        throw new Error("Failed to send SMS");
      }

      pendingFiles.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      setBody("");
      setPendingFiles([]);
      window.requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (node) {
          node.style.height = "auto";
        }
      });
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

  const showSignatureToggle = Boolean(signature) && !isInternalNote;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "bg-background",
        compact
          ? "space-y-2 px-3 pb-2.5 pt-2"
          : "space-y-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3",
        isInternalNote && "bg-warning/[0.06]",
      )}
    >
      {contact ? (
        <div className="flex items-center justify-between gap-3">
          <ClientSmsPhoneField
            contact={contact}
            value={externalPhone ?? resolvedExternalPhone}
            onChange={(next) => onExternalPhoneChange?.(next)}
            disabled={disabled || isSending}
            variant="header"
            className="min-w-0 flex-1"
          />
          {showSignatureToggle ? (
            <label
              htmlFor="sms-include-signature"
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                includeSignature
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted/70",
                (disabled || isSending) && "cursor-not-allowed opacity-50",
              )}
            >
              <Checkbox
                id="sms-include-signature"
                checked={includeSignature}
                onCheckedChange={(value) =>
                  setIncludeSignature(value === true)
                }
                disabled={disabled || isSending}
                className="size-3.5 rounded-[3px]"
                aria-label="Include signature"
              />
              Signature
            </label>
          ) : null}
        </div>
      ) : resolvedExternalPhone ? (
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          <span>To </span>
          <span className="font-medium text-foreground">
            {formatUsPhoneDisplayFromAny(resolvedExternalPhone)}
          </span>
          <span className="text-muted-foreground"> · Unsaved number</span>
        </p>
      ) : null}

      {!isInternalNote ? (
        <SmsTemplateShortcutTiles
          contact={contact}
          companyName={contact?.company_name}
          templateContext={signatureContext}
          disabled={disabled || isSending}
          onInsert={insertTemplateBody}
        />
      ) : null}

      {isInternalNote ? (
        <p className="px-1 text-[11px] font-medium text-warning">
          Internal note — client cannot see this
        </p>
      ) : null}

      {pendingFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-0.5">
          {pendingFiles.map((pending) => (
            <div
              key={pending.id}
              className="relative flex items-center gap-2 rounded-full bg-muted/40 px-2.5 py-1.5 text-xs"
            >
              {pending.previewUrl ? (
                <img
                  src={pending.previewUrl}
                  alt=""
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <Paperclip className="size-3.5 text-muted-foreground" />
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

      <div
        className={cn(
          "flex items-center gap-1 rounded-xl border border-border/40 bg-card p-2 shadow-sm",
          isInternalNote && "border-warning/30",
        )}
      >
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

        <SmsComposerActionsMenu
          contact={contact}
          dealId={dealId}
          disabled={disabled}
          isSending={isSending}
          isInternalNote={isInternalNote}
          onInternalNoteChange={setIsInternalNote}
          canWriteInternalNotes={canWriteInternalNotes}
          includeSignature={includeSignature}
          onIncludeSignatureChange={setIncludeSignature}
          hasSignature={Boolean(signature)}
          onAttachFile={() => fileInputRef.current?.click()}
          onInsertFormLink={insertFormLink}
          compact={compact}
        />

        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={handlePaste}
          placeholder={
            isInternalNote ? "Write an internal note…" : "Write an SMS…"
          }
          className={cn(
            "flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-1.5 shadow-none field-sizing-content focus-visible:ring-0",
            compact
              ? "min-h-[2.25rem] max-h-36 text-xs"
              : "min-h-[2.5rem] max-h-52 text-sm",
          )}
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
          className={cn(
            "shrink-0 rounded-lg bg-foreground text-background hover:bg-foreground/90",
            compact ? "size-8" : "size-9",
          )}
          disabled={!canSend}
          aria-label={isInternalNote ? "Add internal note" : "Send SMS"}
        >
          <ArrowUp className={compact ? "size-4" : "size-[18px]"} strokeWidth={2.5} />
        </Button>
      </div>
    </form>
  );
};
