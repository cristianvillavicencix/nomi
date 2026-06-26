import { useEffect, useState } from "react";
import {
  isResolvableStorageReference,
  resolveStorageDisplayUrl,
} from "@/lib/supabase/storageObjectUrl";

type UseStorageSignedUrlsOptions = {
  path?: string;
  bucket?: string;
  defaultBucket?: string;
  expiresIn?: number;
  enabled?: boolean;
};

export const useStorageSignedUrls = (
  references: string[],
  options?: UseStorageSignedUrlsOptions,
) => {
  const enabled = options?.enabled ?? true;
  const refsKey = references.join("\0");

  const [urls, setUrls] = useState<(string | undefined)[]>(() =>
    references.map((reference) => {
      if (!reference?.trim()) return undefined;
      if (!isResolvableStorageReference(reference, options?.defaultBucket)) {
        return reference;
      }
      return undefined;
    }),
  );

  useEffect(() => {
    if (!enabled) {
      setUrls(references.map((reference) => reference ?? undefined));
      return;
    }

    let cancelled = false;

    void Promise.all(
      references.map(async (reference) => {
        if (!reference?.trim()) return undefined;
        if (!isResolvableStorageReference(reference, options?.defaultBucket)) {
          return reference;
        }
        const signed = await resolveStorageDisplayUrl(reference, options);
        return signed ?? reference;
      }),
    ).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    refsKey,
    options?.bucket,
    options?.defaultBucket,
    options?.expiresIn,
    references,
  ]);

  return urls;
};
