import { parseStorageObjectReference } from "@/lib/supabase/storageObjectUrl";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

const DEFAULT_EXPIRES_IN = 3600;
const BLOB_REVOKE_MS = 60_000;

export const sanitizePrivateStorageFilename = (value: string) =>
  value.replace(/[/\\?%*:| "<>]/g, "-").trim() || "file";

export type PrivateStorageLocation = {
  bucket: string;
  path: string;
  filename?: string;
  expiresIn?: number;
};

export type PrivateStorageReferenceInput = {
  reference: string;
  defaultBucket?: string;
  filename?: string;
  expiresIn?: number;
};

function isExternalHttpUrl(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  );
}

export function resolvePrivateStorageLocation(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): PrivateStorageLocation | null {
  if ("bucket" in input && input.bucket && input.path) {
    return input;
  }
  const refInput = input as PrivateStorageReferenceInput;
  const reference = refInput.reference?.trim();
  if (!reference) return null;
  const parsed = parseStorageObjectReference(
    reference,
    refInput.defaultBucket,
  );
  if (!parsed) {
    if (isExternalHttpUrl(reference)) return null;
    return null;
  }
  return {
    bucket: parsed.bucket,
    path: parsed.path,
    filename: refInput.filename,
    expiresIn: refInput.expiresIn,
  };
}

export async function resolvePrivateStorageSignedUrl(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): Promise<string | null> {
  const location = resolvePrivateStorageLocation(input);
  if (!location) {
    const reference = (input as PrivateStorageReferenceInput).reference?.trim();
    if (reference && isExternalHttpUrl(reference)) return reference;
    return null;
  }
  const { data, error } = await supabase.storage
    .from(location.bucket)
    .createSignedUrl(location.path, location.expiresIn ?? DEFAULT_EXPIRES_IN);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function fetchRemoteFileBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Download failed");
  }
  return response.blob();
}

async function blobFromPrivateStorage(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): Promise<Blob> {
  const signedUrl = await resolvePrivateStorageSignedUrl(input);
  if (!signedUrl) {
    throw new Error("Could not resolve file");
  }
  return fetchRemoteFileBlob(signedUrl);
}

export const isPdfPreviewName = (filename: string) =>
  filename.toLowerCase().endsWith(".pdf");

/** Chrome downloads octet-stream blobs; PDFs need an explicit MIME for the viewer. */
export function blobForInlinePreview(blob: Blob, filename?: string): Blob {
  if (blob.type.includes("pdf") || isPdfPreviewName(filename ?? "")) {
    return blob.type === "application/pdf"
      ? blob
      : new Blob([blob], { type: "application/pdf" });
  }
  return blob;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = sanitizePrivateStorageFilename(filename);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), BLOB_REVOKE_MS);
}

function openBlobInNewTab(blob: Blob, filename: string) {
  const preview = blobForInlinePreview(blob, filename);
  const objectUrl = URL.createObjectURL(preview);
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(objectUrl);
    if (
      preview.type === "application/pdf" ||
      isPdfPreviewName(filename)
    ) {
      throw new Error("Pop-up blocked");
    }
    triggerBlobDownload(blob, filename);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), BLOB_REVOKE_MS);
}

export async function downloadPrivateStorageFile(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): Promise<void> {
  const location = resolvePrivateStorageLocation(input);
  const refInput = input as PrivateStorageReferenceInput;
  const filename =
    location?.filename ??
    refInput.filename ??
    location?.path.split("/").pop() ??
    "file";

  if (!location && refInput.reference && isExternalHttpUrl(refInput.reference)) {
    const blob = await fetchRemoteFileBlob(refInput.reference);
    triggerBlobDownload(blob, filename);
    return;
  }

  try {
    const blob = await blobFromPrivateStorage(input);
    triggerBlobDownload(blob, filename);
  } catch {
    const signedUrl = await resolvePrivateStorageSignedUrl(input);
    if (!signedUrl) throw new Error("Could not download file");
    const blob = await fetchRemoteFileBlob(signedUrl);
    triggerBlobDownload(blob, filename);
  }
}

export async function openPrivateStorageFile(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): Promise<void> {
  const location = resolvePrivateStorageLocation(input);
  const refInput = input as PrivateStorageReferenceInput;
  const filename =
    location?.filename ??
    refInput.filename ??
    location?.path.split("/").pop() ??
    "file";

  if (!location && refInput.reference && isExternalHttpUrl(refInput.reference)) {
    const blob = await fetchRemoteFileBlob(refInput.reference);
    openBlobInNewTab(blob, filename);
    return;
  }

  const blob = await blobFromPrivateStorage(input);
  openBlobInNewTab(blob, filename);
}

/** Returns a blob: URL; caller must revoke when done. */
export async function resolvePrivateStorageBlobUrl(
  input: PrivateStorageLocation | PrivateStorageReferenceInput,
): Promise<string | null> {
  const refInput = input as PrivateStorageReferenceInput;
  const reference = refInput.reference?.trim();

  if (reference && isExternalHttpUrl(reference)) {
    if (reference.startsWith("blob:") || reference.startsWith("data:")) {
      return reference;
    }
    try {
      const blob = await fetchRemoteFileBlob(reference);
      return URL.createObjectURL(blob);
    } catch {
      return reference;
    }
  }

  try {
    const blob = await blobFromPrivateStorage(input);
    return URL.createObjectURL(blob);
  } catch {
    return resolvePrivateStorageSignedUrl(input);
  }
}

export async function resolveDisplayUrlFromReference(
  reference: string | null | undefined,
  options?: {
    path?: string;
    bucket?: string;
    defaultBucket?: string;
    expiresIn?: number;
  },
): Promise<string | null> {
  if (!reference?.trim() && !options?.path) return null;

  if (options?.path && options?.bucket) {
    return resolvePrivateStorageBlobUrl({
      bucket: options.bucket,
      path: options.path,
      expiresIn: options.expiresIn,
    });
  }

  const trimmed = reference?.trim() ?? "";
  if (trimmed) {
    const parsed = parseStorageObjectReference(
      trimmed,
      options?.defaultBucket ?? options?.bucket,
    );
    if (!parsed && isExternalHttpUrl(trimmed)) {
      return resolvePrivateStorageBlobUrl({ reference: trimmed });
    }
    return resolvePrivateStorageBlobUrl({
      reference: trimmed,
      defaultBucket: options?.defaultBucket ?? options?.bucket,
      expiresIn: options?.expiresIn,
    });
  }

  return null;
}
