import { useEffect, useMemo, useRef, useState } from "react";
import { buildMailIframeSrcDoc } from "./mailIframeDocument";

const MAX_IFRAME_HEIGHT = 12_000;

export function MailHtmlBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const srcDoc = useMemo(() => buildMailIframeSrcDoc(html), [html]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        if (!body) return;
        const next = Math.min(
          Math.max(body.scrollHeight + 8, 80),
          MAX_IFRAME_HEIGHT,
        );
        setHeight(next);
      } catch {
        /* sandbox */
      }
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;
      const imgs = doc.querySelectorAll("img");
      imgs.forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", measure, { once: true });
        }
      });
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Email message body"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      className="block w-full border-0 bg-white"
      style={{ height }}
    />
  );
}
