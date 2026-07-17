import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { buildStorageObjectReference } from "@/lib/supabase/storageObjectUrl";
import {
  isTicketReplyAttachmentTooLarge,
  MAX_TICKET_REPLY_ATTACHMENT_BYTES,
} from "@/modules/tickets/ticketReplyAttachmentLimits";
import { ticketReplyAttachmentTooLargeMessage } from "@/modules/tickets/ticketLargeFileTransfer";

/** Max size per deliverable / ticket attachment upload (matches delivery email cap). */
export const MAX_TICKET_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENT_MB =
  MAX_TICKET_ATTACHMENT_BYTES / (1024 * 1024);
export const MAX_TICKET_ATTACHMENTS = 10;

export type TicketReplyAttachment = {
  title: string;
  type: string;
  path: string;
  src: string;
  size?: number;
};

export type PendingTicketAttachmentStatus = "uploading" | "ready" | "error";

export type PendingTicketAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  status: PendingTicketAttachmentStatus;
  progress: number;
  errorMessage?: string;
  uploaded?: TicketReplyAttachment;
};

const buildAttachmentPath = (file: File) => {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";
  return `${Math.random()}${ext}`;
};

const toTicketReplyAttachment = (
  file: File,
  path: string,
): TicketReplyAttachment => ({
  title: file.name,
  type: file.type || "application/octet-stream",
  path,
  src: buildStorageObjectReference("attachments", path),
  size: file.size,
});

const getUploadAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("You must be signed in to upload attachments");
  }
  return token;
};

export async function uploadTicketReplyAttachmentWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TicketReplyAttachment> {
  if (isTicketReplyAttachmentTooLarge(file.size)) {
    throw new Error(ticketReplyAttachmentTooLargeMessage(file.name));
  }
  return uploadTicketAttachmentWithProgress(file, onProgress, {
    maxBytes: MAX_TICKET_REPLY_ATTACHMENT_BYTES,
  });
}

export async function uploadTicketAttachmentWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
  options?: { maxBytes?: number },
): Promise<TicketReplyAttachment> {
  const maxBytes = options?.maxBytes ?? MAX_TICKET_ATTACHMENT_BYTES;
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`"${file.name}" exceeds the ${limitMb} MB limit`);
  }

  const path = buildAttachmentPath(file);
  const token = await getUploadAccessToken();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SB_PUBLISHABLE_KEY;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/${encodeURIComponent(path)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
        return;
      }
      onProgress(10);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(toTicketReplyAttachment(file, path));
        return;
      }

      let message = "Failed to upload attachment";
      try {
        const payload = JSON.parse(xhr.responseText) as {
          message?: string;
          error?: string;
        };
        message = payload.message?.trim() || payload.error?.trim() || message;
      } catch {
        // Keep generic message.
      }
      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading attachment"));
    };

    xhr.send(file);
  });
}

export async function uploadTicketAttachment(
  file: File,
): Promise<TicketReplyAttachment> {
  return uploadTicketAttachmentWithProgress(file);
}
