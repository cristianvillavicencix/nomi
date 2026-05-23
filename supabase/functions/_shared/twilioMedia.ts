import { supabaseAdmin } from "./supabaseAdmin.ts";

const MESSAGING_ATTACHMENTS_BUCKET = "messaging-attachments";

const extensionForContentType = (contentType: string) => {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("pdf")) return ".pdf";
  return "";
};

export const extractTwilioMediaUrls = (params: Record<string, string>) => {
  const numMedia = Number(params.NumMedia ?? "0");
  const mediaUrls: string[] = [];

  for (let index = 0; index < numMedia; index += 1) {
    const mediaUrl = params[`MediaUrl${index}`]?.trim();
    if (mediaUrl) mediaUrls.push(mediaUrl);
  }

  return mediaUrls;
};

export async function mirrorTwilioMediaToStorage(params: {
  accountSid: string;
  authToken: string;
  mediaUrl: string;
  orgId: number;
  conversationId: number;
}) {
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);
  const response = await fetch(params.mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!response.ok) {
    throw new Error("Failed to download inbound MMS from Twilio");
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
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
    throw new Error(error.message ?? "Failed to store inbound MMS");
  }

  return path;
}

export const isPublicHttpUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

export async function resolveTwilioMediaUrls(mediaUrls: string[]) {
  const resolved: string[] = [];
  for (const entry of mediaUrls) {
    if (isPublicHttpUrl(entry)) {
      resolved.push(entry);
      continue;
    }
    const { data, error } = await supabaseAdmin.storage
      .from(MESSAGING_ATTACHMENTS_BUCKET)
      .createSignedUrl(entry, 3600);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Failed to sign MMS URL for Twilio");
    }
    resolved.push(data.signedUrl);
  }
  return resolved;
}
