import { useEffect, useState } from "react";
import { resolvePrivateStorageBlobUrl } from "@/lib/supabase/privateStorageFile";
import {
  normalizeContentId,
  rewriteCidReferencesInHtml,
} from "./mailInlineImages";
import { rewriteHostingerLogoImagesInHtml } from "./hostingerLogo";
import type { MailAttachment } from "./types";

const MAIL_ATTACHMENTS_BUCKET = "mail-attachments";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function resolveMailInlineImages(
  html: string,
  attachments: MailAttachment[],
): Promise<{ html: string; blobUrls: string[] }> {
  if (!html.includes("cid:")) {
    return { html, blobUrls: [] };
  }

  const inlineAttachments = attachments.filter(
    (file) => file.content_id && file.storage_path,
  );
  if (inlineAttachments.length === 0) {
    return { html: rewriteHostingerLogoImagesInHtml(html), blobUrls: [] };
  }

  const cidToUrl = new Map<string, string>();
  const blobUrls: string[] = [];

  await Promise.all(
    inlineAttachments.map(async (file) => {
      const blobUrl = await resolvePrivateStorageBlobUrl({
        bucket: MAIL_ATTACHMENTS_BUCKET,
        path: file.storage_path!,
        expiresIn: SIGNED_URL_TTL_SECONDS,
      });
      if (!blobUrl || !file.content_id) return;
      if (blobUrl.startsWith("blob:")) blobUrls.push(blobUrl);
      cidToUrl.set(file.content_id, blobUrl);
      cidToUrl.set(normalizeContentId(file.content_id), blobUrl);
    }),
  );

  if (cidToUrl.size === 0) {
    return { html: rewriteHostingerLogoImagesInHtml(html), blobUrls };
  }

  return {
    html: rewriteHostingerLogoImagesInHtml(
      rewriteCidReferencesInHtml(html, cidToUrl),
    ),
    blobUrls,
  };
}

export function useResolvedMailHtml(
  html: string | null | undefined,
  attachments: MailAttachment[],
): string | null {
  const [resolved, setResolved] = useState<string | null>(html ?? null);

  useEffect(() => {
    if (!html?.trim()) {
      setResolved(null);
      return;
    }
    if (!html.includes("cid:")) {
      setResolved(rewriteHostingerLogoImagesInHtml(html));
      return;
    }

    let cancelled = false;
    let activeBlobUrls: string[] = [];

    void resolveMailInlineImages(html, attachments).then(({ html: next, blobUrls }) => {
      if (cancelled) {
        for (const url of blobUrls) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        }
        return;
      }
      for (const url of activeBlobUrls) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
      activeBlobUrls = blobUrls;
      setResolved(next);
    });

    return () => {
      cancelled = true;
      for (const url of activeBlobUrls) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    };
  }, [html, attachments]);

  return resolved;
}

export function isDownloadableMailAttachment(file: MailAttachment): boolean {
  // Inline images use content_id for cid: embedding; hide those from the bar.
  // Real files (xls, pdf, …) must stay visible even if the MIME stamped a Content-ID.
  if (!file.content_id) return true;
  const mime = (file.mime_type ?? "").toLowerCase();
  return !mime.startsWith("image/");
}
