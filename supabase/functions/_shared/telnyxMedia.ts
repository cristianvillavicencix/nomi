import { supabaseAdmin } from "./supabaseAdmin.ts";

const MESSAGING_ATTACHMENTS_BUCKET = "messaging-attachments";

const extensionForContentType = (contentType: string) => {
  if (contentType.includes("jpeg") || contentType.includes("jpg"))
    return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("pdf")) return ".pdf";
  return "";
};

/** Download Telnyx MMS media and store in private messaging-attachments bucket. */
export async function mirrorTelnyxMediaToStorage(params: {
  mediaUrl: string;
  orgId: number;
  conversationId: number;
}) {
  const response = await fetch(params.mediaUrl);
  if (!response.ok) {
    throw new Error("Failed to download inbound MMS from Telnyx");
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const extension = extensionForContentType(contentType);
  const path = `org_${params.orgId}/conversation_${params.conversationId}/${crypto.randomUUID()}${extension}`;
  const bytes = new Uint8Array(await response.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message ?? "Failed to store inbound Telnyx MMS");
  }

  return path;
}
