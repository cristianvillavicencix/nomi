import { supabaseAdmin } from "./supabaseAdmin.ts";

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
  const path = `sms-inbound/${crypto.randomUUID()}${extension}`;
  const bytes = new Uint8Array(await response.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from("attachments").upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to store inbound MMS");
  }

  const { data } = supabaseAdmin.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}
