import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const STORAGE_OBJECT_PATH_RE =
  /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/?#]+)\/(.+)$/i;

export type StorageObjectRef = {
  bucket: string;
  path: string;
};

export const parseStorageObjectReference = (
  reference: string,
  defaultBucket?: string,
): StorageObjectRef | null => {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  const match = trimmed.match(STORAGE_OBJECT_PATH_RE);
  if (match) {
    return {
      bucket: match[1],
      path: decodeURIComponent(match[2]),
    };
  }

  // Root-absolute app assets (e.g. /logos/sigma.png) are not storage paths.
  if (trimmed.startsWith("/")) {
    return null;
  }

  if (
    defaultBucket &&
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("blob:") &&
    !trimmed.startsWith("data:")
  ) {
    return { bucket: defaultBucket, path: trimmed };
  }

  return null;
};

export const isResolvableStorageReference = (
  reference: string | null | undefined,
  defaultBucket?: string,
) =>
  Boolean(reference && parseStorageObjectReference(reference, defaultBucket));

/** Persisted storage identifier (path only). Use defaultBucket when resolving. */
export const buildStorageObjectReference = (
  _supabaseUrl: string,
  _bucket: string,
  path: string,
) => path;

export const createStorageSignedUrl = async (
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error(
      "[storageObjectUrl] createSignedUrl failed",
      bucket,
      path,
      error,
    );
    return null;
  }
  return data.signedUrl;
};

export const resolveStorageDisplayUrl = async (
  supabase: SupabaseClient,
  reference: string | null | undefined,
  options?: { defaultBucket?: string; expiresIn?: number },
): Promise<string | null> => {
  if (!reference?.trim()) return null;

  const trimmed = reference.trim();
  const parsed = parseStorageObjectReference(trimmed, options?.defaultBucket);
  if (!parsed) {
    return trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("/")
      ? trimmed
      : null;
  }

  return createStorageSignedUrl(
    supabase,
    parsed.bucket,
    parsed.path,
    options?.expiresIn ?? 3600,
  );
};
