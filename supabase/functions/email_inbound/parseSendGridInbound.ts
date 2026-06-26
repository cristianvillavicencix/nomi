import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  buildStorageObjectReference,
  createStorageSignedUrl,
} from "../_shared/storageObjectUrl.ts";
import {
  assertInboundAttachmentCount,
  assertInboundAttachmentSize,
  MAX_INBOUND_ATTACHMENTS,
} from "../_shared/inboundAttachmentLimits.ts";
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

const parseHeadersBlock = (raw: string | null | undefined) => {
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

const fixPublicUrl = (url: string) => {
  const jwtIssuer = Deno.env.get("SB_JWT_ISSUER") ?? "";
  const localUrl = jwtIssuer.replace("/auth/v1", "");
  return url.replace("http://kong:8000", localUrl);
};

const uploadSendGridAttachments = async (form: FormData) => {
  const attachments: Attachment[] = [];
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

  const sortedKeys = Array.from(attachmentKeys)
    .sort((a, b) => {
      const aNum = Number(a.replace(/\D/g, ""));
      const bNum = Number(b.replace(/\D/g, ""));
      return aNum - bNum;
    })
    .slice(0, MAX_INBOUND_ATTACHMENTS);

  assertInboundAttachmentCount(sortedKeys.length);

  let metaByKey: Record<
    string,
    { filename?: string; name?: string; type?: string; "content-id"?: string }
  > = {};
  if (infoRaw) {
    try {
      const parsed = JSON.parse(infoRaw) as Record<
        string,
        { filename?: string; name?: string; type?: string }
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

  for (const fieldName of sortedKeys) {
    const file = form.get(fieldName);
    if (!(file instanceof File)) continue;

    const meta = metaByKey[fieldName] ?? {};
    const title =
      meta.filename?.trim() ||
      meta.name?.trim() ||
      file.name ||
      fieldName;
    const type = meta.type?.trim() || file.type || "application/octet-stream";
    const fileParts = title.split(".");
    const fileExt = fileParts.length > 1 ? `.${fileParts.pop()}` : "";
    const fileName = `${Math.random()}${fileExt}`;
    const bytes = await file.arrayBuffer();
    assertInboundAttachmentSize(bytes.byteLength, title);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("attachments")
      .upload(fileName, bytes, { contentType: type });

    if (uploadError) {
      console.error("email_inbound.upload_error", uploadError);
      throw new Error(`Failed to upload attachment "${title}"`);
    }

    const signed = await createStorageSignedUrl(
      supabaseAdmin,
      "attachments",
      fileName,
      60 * 60 * 24 * 7,
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const reference = buildStorageObjectReference(
      supabaseUrl,
      "attachments",
      fileName,
    );
    attachments.push({
      title,
      type,
      path: fileName,
      src: fixPublicUrl(signed ?? reference),
      contentId: meta["content-id"]?.trim() || null,
    });
  }

  return attachments;
};

export const parseSendGridInbound = async (form: FormData) => {
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
    Headers.find((entry) => entry.Name.toLowerCase() === "message-id")?.Value
      ?.replace(/^<|>$/g, "")
      .trim() ?? crypto.randomUUID();

  const payload: PostmarkInboundPayload = {
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

  const attachments = await uploadSendGridAttachments(form);
  return { payload, attachments };
};
