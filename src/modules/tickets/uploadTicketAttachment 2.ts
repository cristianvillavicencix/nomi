import * as tus from "tus-js-client";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { buildStorageObjectReference } from "@/lib/supabase/storageObjectUrl";

/** Max size per deliverable / ticket attachment upload (matches delivery email cap). */
export const MAX_TICKET_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENT_MB =
  MAX_TICKET_ATTACHMENT_BYTES / (1024 * 1024);
export const MAX_TICKET_ATTACHMENTS = 10;

/** Above this size, use chunked resumable (TUS) uploads to avoid TLS flakiness. */
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;
const STANDARD_UPLOAD_MAX_ATTEMPTS = 3;
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export type TicketReplyAttachment = {
  title: string;
  type: string;
  path: string;
  src: string;
  size?: number;
  /** Oversized-for-email files: edge sends a 7-day signed link instead of MIME. */
  send_as_download_link?: boolean;
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
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}${ext}`;
};

const isAlreadyExistsUploadError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    message.includes("already exists") ||
    message.includes("resource already exists") ||
    message.includes("response code: 409") ||
    message.includes("status code 409") ||
    /\b409\b/.test(message)
  );
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isRetryableUploadError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    message.includes("network") ||
    message.includes("ssl") ||
    message.includes("tls") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("err_ssl") ||
    message.includes("bad_record_mac")
  );
};

const getStorageProjectRef = () => {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  try {
    const host = new URL(supabaseUrl).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getResumableEndpoint = () => {
  const projectRef = getStorageProjectRef();
  if (projectRef) {
    // Direct storage hostname is recommended for large uploads.
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  return `${supabaseUrl}/storage/v1/upload/resumable`;
};

const uploadViaXhrOnce = async (
  file: File,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<void> => {
  const token = await getUploadAccessToken();
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const apiKey = String(import.meta.env.VITE_SB_PUBLISHABLE_KEY ?? "");
  const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/${encodeURIComponent(path)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
        return;
      }
      onProgress(10);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
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
      reject(
        new Error(
          "Network error while uploading attachment (connection interrupted). Retrying…",
        ),
      );
    };

    xhr.send(file);
  });
};

const uploadViaXhrWithRetries = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TicketReplyAttachment> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= STANDARD_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    const path = buildAttachmentPath(file);
    try {
      await uploadViaXhrOnce(file, path, onProgress);
      return toTicketReplyAttachment(file, path);
    } catch (error) {
      lastError = error;
      if (
        attempt >= STANDARD_UPLOAD_MAX_ATTEMPTS ||
        !isRetryableUploadError(error)
      ) {
        break;
      }
      onProgress?.(Math.max(5, Math.round((attempt / STANDARD_UPLOAD_MAX_ATTEMPTS) * 20)));
      await sleep(500 * attempt);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(
      lastError.message.includes("Network error")
        ? `Could not upload "${file.name}". Check your connection and try again.`
        : lastError.message,
    );
  }
  throw new Error(`Could not upload "${file.name}"`);
};

const uploadViaResumableTusOnce = async (
  file: File,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<void> => {
  const token = await getUploadAccessToken();
  const apiKey = String(import.meta.env.VITE_SB_PUBLISHABLE_KEY ?? "");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: getResumableEndpoint(),
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: apiKey,
        // Allow replace if a prior incomplete/failed attempt left the object.
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      metadata: {
        bucketName: "attachments",
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Network error while uploading attachment";
        reject(new Error(message));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!onProgress || bytesTotal <= 0) return;
        onProgress(
          Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100)),
        );
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve();
      },
    });

    // Always start a fresh upload for a new objectName. Resuming a fingerprint
    // from a previous failed attempt often hits Storage 409 (object exists).
    upload.start();
  });
};

const objectExistsInAttachments = async (path: string) => {
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, 60);
  return !error && Boolean(data?.signedUrl);
};

const uploadViaResumableTus = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TicketReplyAttachment> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const path = buildAttachmentPath(file);
    try {
      await uploadViaResumableTusOnce(file, path, onProgress);
      return toTicketReplyAttachment(file, path);
    } catch (error) {
      lastError = error;

      if (isAlreadyExistsUploadError(error)) {
        // Race / leftover object: if it landed, treat as success; else new path.
        if (await objectExistsInAttachments(path)) {
          onProgress?.(100);
          return toTicketReplyAttachment(file, path);
        }
        onProgress?.(Math.max(5, attempt * 10));
        continue;
      }

      if (
        attempt >= 3 ||
        !isRetryableUploadError(error)
      ) {
        break;
      }
      onProgress?.(Math.max(5, attempt * 10));
      await sleep(400 * attempt);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(
      isAlreadyExistsUploadError(lastError) ||
        lastError.message.toLowerCase().includes("network") ||
        lastError.message.toLowerCase().includes("ssl")
        ? `Could not upload "${file.name}". Check your connection and try again.`
        : lastError.message,
    );
  }
  throw new Error(`Could not upload "${file.name}"`);
};

export async function uploadTicketReplyAttachmentWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TicketReplyAttachment> {
  // Reply uploads share the 25 MB storage cap. Oversized-for-email files are
  // sent as 7-day signed download links by reply_ticket (not MIME attachments).
  return uploadTicketAttachmentWithProgress(file, onProgress, {
    maxBytes: MAX_TICKET_ATTACHMENT_BYTES,
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

  if (file.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    try {
      return await uploadViaResumableTus(file, onProgress);
    } catch (error) {
      // Fall back to standard upload with retries if TUS is flaky/unavailable.
      if (
        !isRetryableUploadError(error) &&
        !isAlreadyExistsUploadError(error)
      ) {
        throw error;
      }
      return uploadViaXhrWithRetries(file, onProgress);
    }
  }

  return uploadViaXhrWithRetries(file, onProgress);
}

export async function uploadTicketAttachment(
  file: File,
): Promise<TicketReplyAttachment> {
  return uploadTicketAttachmentWithProgress(file);
}
