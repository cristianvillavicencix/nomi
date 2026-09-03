import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { useGetIdentity, useNotify, type Identifier } from "ra-core";

import { IconButton } from "@/components/ui/icon-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type {
  Contact,
  Conversation,
  ConversationMessage,
} from "@/modules/types";
import { cn } from "@/lib/utils";
import { uploadSmsMedia } from "@/modules/messages/smsMediaUpload";
import { SmsComposerActionsMenu } from "@/modules/messages/composer/SmsComposerActionsMenu";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { isScopedWorkspaceUser } from "@/lib/permissions/permissionCatalog";
import { useOrganizationSmsSignature } from "@/modules/settings/useOrganizationSmsSignature";
import { ClientSmsPhoneField } from "@/modules/messages/ClientSmsPhoneField";
import { resolveClientSmsPhone } from "@/modules/messages/messageContactUtils";
import {
  formatUsPhoneDisplayFromAny,
  normalizeUsPhoneToE164,
} from "@/utils/phone";
import { SmsTemplateShortcutTiles } from "@/modules/messages/SmsTemplateShortcutTiles";
import { SmsBodyLengthHint } from "@/modules/messages/SmsBodyLengthHint";
import { isSmsLengthOverLimit } from "@/modules/messages/smsMessageLimits";
import {
  SMS_COMPOSER_FORM_PROPS,
  SMS_COMPOSER_TEXTAREA_PROPS,
} from "@/modules/messages/smsComposerInputProps";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

const MMS_MAX_ITEMS = 10;
const MMS_MAX_TOTAL_BYTES = 1_000_000;
const MMS_MAX_IMAGE_WIDTH_PX = 1600;
const JPEG_QUALITY_TRIES = [0.82, 0.72, 0.62];

const formatBytesLabel = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} KB`;

const compressImageFileForMms = async (file: File, maxBytes: number) => {
  if (!file.type.startsWith("image/")) return file;
  // ponytail: we don't read EXIF orientation; rare upside-down photos; upgrade by applying EXIF rotation.
  if (!file.size || file.size <= maxBytes && file.size < 800_000) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Failed to load image"));
      node.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MMS_MAX_IMAGE_WIDTH_PX / srcW);
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // If the image has transparency, JPEG needs a background.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dstW, dstH);
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const baseName = file.name.replace(/\.[^.]+$/, "");
    let lastBlob: Blob | null = null;

    for (const q of JPEG_QUALITY_TRIES) {
      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          "image/jpeg",
          q,
        );
      });
      if (!blob) continue;
      lastBlob = blob;
      if (blob.size <= maxBytes) break;
    }

    if (!lastBlob) return file;
    return new File([lastBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const isStandardUser = isScopedWorkspaceUser(
    identity as AccessIdentity | undefined,
  );
  const sendClientSms = useSendClientSms();
  const {
    signature,
    settings: orgSignatureSettings,
    signatureContext,
    signatureRequired,
  } = useOrganizationSmsSignature({ forceUserSignature: isStandardUser });
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
    if (signatureRequired) {
      setIncludeSignature(true);
      return;
    }
    if (signatureDefaultApplied.current) return;
    if (orgSignatureSettings?.sms_signature_enabled == null) return;
    setIncludeSignature(orgSignatureSettings.sms_signature_enabled);
    signatureDefaultApplied.current = true;
  }, [orgSignatureSettings?.sms_signature_enabled, signatureRequired]);

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

  const outboundBody = useMemo(() => {
    const trimmed = body.trim();
    if (isInternalNote) return trimmed;
    const shouldIncludeSignature =
      Boolean(signature) && (signatureRequired || includeSignature);
    if (shouldIncludeSignature && trimmed.length > 0) {
      return `${trimmed}\n${signature}`;
    }
    return trimmed;
  }, [body, includeSignature, isInternalNote, signature, signatureRequired]);

  const smsOverLimit = !isInternalNote && isSmsLengthOverLimit(outboundBody);

  const canSend =
    !disabled &&
    !isSending &&
    !smsOverLimit &&
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
    const nextCount = pendingFiles.length + 1;
    if (nextCount > MMS_MAX_ITEMS) {
      notify(`MMS supports up to ${MMS_MAX_ITEMS} attachments.`, {
        type: "warning",
      });
      return;
    }
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
      const compressedFiles: File[] = [];
      const maxBytesPerItem = Math.floor(
        (MMS_MAX_TOTAL_BYTES * 0.95) / Math.max(pendingFiles.length, 1),
      );
      for (const pending of pendingFiles) {
        compressedFiles.push(
          await compressImageFileForMms(pending.file, maxBytesPerItem),
        );
      }

      const totalBytes = compressedFiles.reduce((sum, entry) => sum + entry.size, 0);
      if (pendingFiles.length > MMS_MAX_ITEMS) {
        throw new Error(`MMS supports up to ${MMS_MAX_ITEMS} attachments.`);
      }
      if (totalBytes > MMS_MAX_TOTAL_BYTES) {
        throw new Error(
          `MMS attachments must stay under ${formatBytesLabel(MMS_MAX_TOTAL_BYTES)} total (got ${formatBytesLabel(totalBytes)}).`,
        );
      }

      const uploadedUrls: string[] = [];
      for (const file of compressedFiles) {
        uploadedUrls.push(await uploadSmsMedia(file, identity?.org_id));
      }

      let finalBody = body.trim();
      const shouldIncludeSignature =
        !isInternalNote && signature && (signatureRequired || includeSignature);
      if (shouldIncludeSignature && finalBody.length > 0) {
        finalBody = `${finalBody}\n${signature}`;
      }

      if (!isInternalNote && finalBody && isSmsLengthOverLimit(finalBody)) {
        throw new Error("SMS is too long. Shorten the message before sending.");
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

  const showSignatureToggle =
    Boolean(signature) && !isInternalNote && !signatureRequired;
  const showSignatureBadge =
    Boolean(signature) && !isInternalNote && signatureRequired;

  return (
    <form
      onSubmit={handleSubmit}
      {...SMS_COMPOSER_FORM_PROPS}
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
                onCheckedChange={(value) => setIncludeSignature(value === true)}
                disabled={disabled || isSending}
                className="size-3.5 rounded-[3px]"
                aria-label="Include signature"
              />
              Signature
            </label>
          ) : showSignatureBadge ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Signature on
            </span>
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
      ) : showSignatureBadge ? (
        <p className="text-xs font-medium text-primary">Signature on</p>
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
              <div className="min-w-0">
                <div className="max-w-[140px] truncate">{pending.file.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBytesLabel(pending.file.size)}
                </div>
              </div>
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
          includeSignature={signatureRequired || includeSignature}
          onIncludeSignatureChange={setIncludeSignature}
          hasSignature={Boolean(signature)}
          signatureRequired={signatureRequired}
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
          {...SMS_COMPOSER_TEXTAREA_PROPS}
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

        <IconButton
          type="submit"
          variant="primary"
          className={cn("shrink-0 rounded-lg", compact ? "" : "size-9")}
          disabled={!canSend}
          aria-label={isInternalNote ? "Add internal note" : "Send SMS"}
        >
          <ArrowUp
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={2.5}
          />
        </IconButton>
      </div>

      {!isInternalNote ? (
        <SmsBodyLengthHint body={outboundBody} className="px-0.5" />
      ) : null}
    </form>
  );
};
