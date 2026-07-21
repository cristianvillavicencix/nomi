import { useEffect, useState } from "react";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
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
): Promise<string> {
  if (!html.includes("cid:")) return html;

  const inlineAttachments = attachments.filter(
    (file) => file.content_id && file.storage_path,
  );
  if (inlineAttachments.length === 0) return html;

  const cidToUrl = new Map<string, string>();

  await Promise.all(
    inlineAttachments.map(async (file) => {
      const { data, error } = await supabase.storage
        .from(MAIL_ATTACHMENTS_BUCKET)
        .createSignedUrl(file.storage_path!, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl || !file.content_id) return;
      cidToUrl.set(file.content_id, data.signedUrl);
      cidToUrl.set(normalizeContentId(file.content_id), data.signedUrl);
    }),
  );

  if (cidToUrl.size === 0) {
    return rewriteHostingerLogoImagesInHtml(html);
  }
  return rewriteHostingerLogoImagesInHtml(
    rewriteCidReferencesInHtml(html, cidToUrl),
  );
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
    void resolveMailInlineImages(html, attachments).then((next) => {
      if (!cancelled) setResolved(next);
    });

    return () => {
      cancelled = true;
    };
  }, [html, attachments]);

  return resolved;
}

export function isDownloadableMailAttachment(file: MailAttachment): boolean {
  return !file.content_id;
}
