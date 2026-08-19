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

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function writePreviewTab(tab: Window, html: string) {
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
  tab.opener = null;
}

/** Must run in the click stack — browsers block window.open after await. */
function openPreviewTab(filename: string): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (!tab) return null;
  const title = sanitizePrivateStorageFilename(filename);
  try {
    writePreviewTab(
      tab,
      `<!DOCTYPE html><title>${escapeHtmlAttr(title)}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font:14px system-ui,sans-serif;color:#444">Opening…</body>`,
    );
  } catch {
    // Tab is still usable; we'll replace the document when the file URL is ready.
  }
  return tab;
}

function showPdfInOpenedTab(tab: Window, fileUrl: string, filename: string) {
  const title = sanitizePrivateStorageFilename(filename);
  writePreviewTab(
    tab,
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlAttr(title)}</title><style>html,body,embed{margin:0;border:0;width:100%;height:100%}html,body{height:100%;overflow:hidden}</style></head><body><embed src="${escapeHtmlAttr(fileUrl)}" type="application/pdf" title="${escapeHtmlAttr(title)}" /></body></html>`,
  );
}

function showBlobInOpenedTab(tab: Window, blob: Blob, filename: string) {
  const preview = blobForInlinePreview(blob, filename);
  const objectUrl = URL.createObjectURL(preview);
  try {
    tab.location.replace(objectUrl);
    tab.opener = null;
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Pop-up blocked");
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

  const tab = openPreviewTab(filename);
  if (!tab) throw new Error("Pop-up blocked");

  const previewPdf = isPdfPreviewName(filename);

  try {
    const signedUrl = await resolvePrivateStorageSignedUrl(input);
    if (!signedUrl) throw new Error("Could not resolve file");

    if (previewPdf) {
      showPdfInOpenedTab(tab, signedUrl, filename);
      return;
    }

    const blob = await fetchRemoteFileBlob(signedUrl);
    showBlobInOpenedTab(tab, blob, filename);
  } catch (error) {
    tab.close();
    throw error;
  }
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
