import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

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
) => Boolean(reference && parseStorageObjectReference(reference, defaultBucket));

/** Persisted storage identifier (path only). Use defaultBucket when resolving. */
export const buildStorageObjectReference = (_bucket: string, path: string) =>
  path;

export const createStorageSignedUrl = async (
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
};

export const resolveStorageDisplayUrl = async (
  reference: string | null | undefined,
  options?: { path?: string; bucket?: string; defaultBucket?: string; expiresIn?: number },
): Promise<string | null> => {
  const { resolveDisplayUrlFromReference } = await import("./privateStorageFile");
  return resolveDisplayUrlFromReference(reference, options);
};
