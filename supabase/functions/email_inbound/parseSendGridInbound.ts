import {
  MAX_INBOUND_ATTACHMENTS,
  type SkippedInboundAttachment,
} from "../_shared/inboundAttachmentLimits.ts";
import {
  enforceAttachmentCountLimit,
  uploadInboundAttachmentBytes,
} from "../_shared/uploadInboundAttachments.ts";
import type { Attachment } from "../postmark/extractAndUploadAttachments.ts";
import type { PostmarkInboundPayload } from "../postmark/processTicketInbound.ts";

const parseEmailAddress = (raw: string) => {
  const trimmed = raw.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return {
      Email: angle[2].trim(),
      Name: angle[1].replace(/^["']|["']$/g, "").trim() || undefined,
    };
  }
  return { Email: trimmed };
};

const splitAddressList = (raw: string) =>
  raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export const parseHeadersBlock = (raw: string | null | undefined) => {
  if (!raw?.trim()) return [];
  const headers: Array<{ Name: string; Value: string }> = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let currentName: string | null = null;
  let currentValue = "";

  const push = () => {
    if (!currentName) return;
    headers.push({ Name: currentName, Value: currentValue.trim() });
    currentName = null;
    currentValue = "";
  };

  for (const line of lines) {
    if (!line.trim()) {
      push();
      continue;
    }
    if (/^\s/.test(line) && currentName) {
      currentValue += ` ${line.trim()}`;
      continue;
    }
    push();
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    currentName = match[1].trim();
    currentValue = match[2];
  }
  push();
  return headers;
};

export const buildSendGridInboundPayload = (form: FormData): PostmarkInboundPayload => {
  const fromRaw = form.get("from")?.toString() ?? "";
  const toRaw = form.get("to")?.toString() ?? "";
  const ccRaw = form.get("cc")?.toString() ?? "";
  const subject = form.get("subject")?.toString() ?? "";
  const textBody = form.get("text")?.toString() ?? "";
  const htmlBody = form.get("html")?.toString() ?? "";
  const headersRaw = form.get("headers")?.toString() ?? "";
  const envelopeRaw = form.get("envelope")?.toString() ?? "";

  const ToFull = splitAddressList(toRaw).map(parseEmailAddress);
  const CcFull = splitAddressList(ccRaw).map(parseEmailAddress);
  const Headers = parseHeadersBlock(headersRaw);

  let envelopeTo: string[] = [];
  try {
    const envelope = JSON.parse(envelopeRaw) as { to?: string[] };
    envelopeTo = envelope.to ?? [];
  } catch {
    envelopeTo = [];
  }

  for (const email of envelopeTo) {
    if (email.trim()) ToFull.push(parseEmailAddress(email));
  }

  const messageId =
    Headers.find((entry) => entry.Name.toLowerCase() === "message-id")
      ?.Value?.replace(/^<|>$/g, "")
      .trim() ?? crypto.randomUUID();

  return {
    MessageID: messageId,
    Subject: subject,
    TextBody: textBody,
    HtmlBody: htmlBody || undefined,
    FromFull: parseEmailAddress(fromRaw),
    ToFull,
    CcFull: CcFull.length ? CcFull : undefined,
    Headers,
    OriginalRecipient: ToFull[0]?.Email,
  };
};

export const uploadSendGridAttachments = async (
  form: FormData,
  maxBytes: number,
) => {
  const attachments: Attachment[] = [];
  const skippedAttachments: SkippedInboundAttachment[] = [];
  const infoRaw = form.get("attachment-info")?.toString();

  const attachmentKeys = new Set<string>();
  if (infoRaw) {
    try {
      const parsed = JSON.parse(infoRaw) as Record<string, unknown>;
      if (Array.isArray(parsed)) {
        for (let index = 0; index < parsed.length; index += 1) {
          attachmentKeys.add(`attachment${index + 1}`);
        }
      } else {
        for (const key of Object.keys(parsed)) {
          if (/^attachment\d+$/i.test(key)) attachmentKeys.add(key);
        }
      }
    } catch {
      console.warn("email_inbound.attachment_info_parse_failed");
    }
  }

  if (!attachmentKeys.size) {
    for (const key of form.keys()) {
      if (/^attachment\d+$/i.test(key)) attachmentKeys.add(key);
    }
  }

  const sortedKeys = Array.from(attachmentKeys).sort((a, b) => {
    const aNum = Number(a.replace(/\D/g, ""));
    const bNum = Number(b.replace(/\D/g, ""));
    return aNum - bNum;
  });

  const { allowedKeys, skipped: countSkipped } = enforceAttachmentCountLimit(
    sortedKeys,
    skippedAttachments,
  );
  skippedAttachments.push(...countSkipped);

  let metaByKey: Record<
    string,
    { filename?: string; name?: string; type?: string; "content-id"?: string }
  > = {};
  if (infoRaw) {
    try {
      const parsed = JSON.parse(infoRaw) as Record<
        string,
        { filename?: string; name?: string; type?: string; "content-id"?: string }
      >;
      if (Array.isArray(parsed)) {
        parsed.forEach((meta, index) => {
          metaByKey[`attachment${index + 1}`] = meta;
        });
      } else {
        metaByKey = parsed;
      }
    } catch {
      metaByKey = {};
    }
  }

  for (const fieldName of allowedKeys.slice(0, MAX_INBOUND_ATTACHMENTS)) {
    const file = form.get(fieldName);
    if (!(file instanceof File)) continue;

    const meta = metaByKey[fieldName] ?? {};
    const title =
      meta.filename?.trim() || meta.name?.trim() || file.name || fieldName;
    const type = meta.type?.trim() || file.type || "application/octet-stream";
    const bytes = await file.arrayBuffer();

    const result = await uploadInboundAttachmentBytes({
      title,
      type,
      bytes,
      contentId: meta["content-id"]?.trim() || null,
      maxBytes,
    });

    if (result.attachment) {
      attachments.push(result.attachment);
    } else if (result.skipped) {
      skippedAttachments.push(result.skipped);
    }
  }

  return { attachments, skippedAttachments };
};

export const parseSendGridInbound = async (
  form: FormData,
  maxBytes: number,
) => {
  const payload = buildSendGridInboundPayload(form);
  const { attachments, skippedAttachments } = await uploadSendGridAttachments(
    form,
    maxBytes,
  );
  return { payload, attachments, skippedAttachments };
};
