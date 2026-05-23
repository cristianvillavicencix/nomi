import { useEffect, useState } from "react";
import { createSignedMediaUrl } from "@/lbs/messages/smsMediaUpload";
import { isLegacyPublicMediaUrl } from "@/lbs/messages/messagingStorage";

export const useResolvedMediaUrl = (storagePath: string | null | undefined) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    if (isLegacyPublicMediaUrl(storagePath)) {
      setUrl(storagePath);
      return;
    }
    let cancelled = false;
    void createSignedMediaUrl(storagePath).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
};
