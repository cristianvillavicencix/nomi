import { useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoLightboxGrid } from "@/components/ui/photo-lightbox-grid";
import { isLegacyPublicMediaUrl } from "@/modules/messages/messagingStorage";
import {
  createSignedMediaUrl,
  downloadMediaUrl,
  getMediaFileName,
  isImageMediaUrl,
} from "@/modules/messages/smsMediaUpload";

const useResolvedMediaUrls = (paths: string[]) => {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const pathsKey = paths.join("\0");

  useEffect(() => {
    if (!paths.length) {
      setUrls([]);
      return;
    }

    let cancelled = false;
    void Promise.all(
      paths.map(async (path) => {
        if (isLegacyPublicMediaUrl(path)) return path;
        try {
          return await createSignedMediaUrl(path);
        } catch {
          return null;
        }
      }),
    ).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [pathsKey, paths]);

  return urls;
};

const NonImageAttachment = ({
  storagePath,
  alt,
}: {
  storagePath: string;
  alt?: string;
}) => {
  const fileName = getMediaFileName(storagePath);

  return (
    <div className="flex items-center gap-2 rounded-sm bg-black/5 px-2.5 py-2 text-xs dark:bg-white/5">
      <Paperclip className="size-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{alt ?? fileName}</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 shrink-0 rounded-full px-2 text-xs"
        onClick={() => void downloadMediaUrl(storagePath)}
      >
        Download
      </Button>
    </div>
  );
};

export const SmsMessageMedia = ({
  urls,
  alt,
}: {
  urls: string[];
  alt?: string;
}) => {
  const resolvedUrls = useResolvedMediaUrls(urls);
  const loading = resolvedUrls.length < urls.length;

  const photoItems = useMemo(() => {
    const items: { id: string; src: string; alt: string }[] = [];
    urls.forEach((storagePath, index) => {
      if (!isImageMediaUrl(storagePath)) return;
      const resolvedUrl = resolvedUrls[index];
      if (!resolvedUrl) return;
      const label = alt ?? getMediaFileName(storagePath);
      items.push({
        id: storagePath,
        src: resolvedUrl,
        alt: label,
      });
    });
    return items;
  }, [alt, resolvedUrls, urls]);

  const nonImagePaths = urls.filter((path) => !isImageMediaUrl(path));

  if (loading && photoItems.length === 0 && nonImagePaths.length === 0) {
    return (
      <div className="mb-1 text-xs text-muted-foreground">
        Loading attachment…
      </div>
    );
  }

  return (
    <div className="mb-1 space-y-2">
      {photoItems.length > 0 ? (
        <PhotoLightboxGrid
          items={photoItems}
          variant="compact"
          onDownloadItem={(item) => void downloadMediaUrl(item.id)}
        />
      ) : null}
      {nonImagePaths.map((storagePath) => (
        <NonImageAttachment
          key={storagePath}
          storagePath={storagePath}
          alt={alt}
        />
      ))}
    </div>
  );
};
