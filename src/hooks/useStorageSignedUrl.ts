import { useEffect, useState } from "react";
import {
  isResolvableStorageReference,
  resolveStorageDisplayUrl,
} from "@/lib/supabase/storageObjectUrl";

type UseStorageSignedUrlOptions = {
  path?: string;
  bucket?: string;
  defaultBucket?: string;
  expiresIn?: number;
  enabled?: boolean;
};

export const useStorageSignedUrl = (
  reference: string | null | undefined,
  options?: UseStorageSignedUrlOptions,
) => {
  const enabled = options?.enabled ?? true;
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!reference?.trim()) return undefined;
    if (!isResolvableStorageReference(reference, options?.defaultBucket)) {
      return reference;
    }
    return undefined;
  });

  useEffect(() => {
    if (!enabled) {
      setUrl(reference ?? undefined);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      if (!reference?.trim() && !options?.path) {
        setUrl(undefined);
        return;
      }

      if (
        reference &&
        !isResolvableStorageReference(reference, options?.defaultBucket) &&
        !options?.path
      ) {
        setUrl(reference);
        return;
      }

      const signed = await resolveStorageDisplayUrl(reference, options);
      if (!cancelled) {
        setUrl(signed ?? reference ?? undefined);
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    reference,
    options?.path,
    options?.bucket,
    options?.defaultBucket,
    options?.expiresIn,
  ]);

  return url;
};
