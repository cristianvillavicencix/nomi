import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  buildMailIframeSrcDoc,
  type MailIframeLayout,
  type MailIframeVariant,
} from "./mailIframeDocument";
import { cn } from "@/lib/utils";

const MAX_IFRAME_HEIGHT = 12_000;
const MEASURE_DEBOUNCE_MS = 180;

/** First paint before iframe load — generous enough to avoid clipping while measuring. */
function initialIframeHeightEstimate(rawHtmlLength: number): number {
  if (rawHtmlLength <= 0) return 160;
  const estimated = Math.ceil(rawHtmlLength / 16);
  return Math.min(2400, Math.max(320, estimated));
}

function blockContentHeight(el: HTMLElement): number {
  return Math.max(
    el.scrollHeight,
    el.offsetHeight,
    Math.ceil(el.getBoundingClientRect().height),
  );
}

function measurePaintedContentHeight(doc: Document): number {
  const body = doc.body;
  const view = doc.defaultView;
  if (!view) return body.scrollHeight;

  const bodyTop = body.getBoundingClientRect().top;
  let maxBottom = bodyTop;

  const visit = (el: Element) => {
    if (!(el instanceof HTMLElement)) return;
    const style = view.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 || rect.width > 0) {
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    for (const child of el.children) visit(child);
  };

  visit(body);

  const bodyStyle = view.getComputedStyle(body);
  const pb = Number.parseFloat(bodyStyle.paddingBottom) || 0;

  return Math.ceil(maxBottom - bodyTop + pb + 8);
}

/**
 * Expand iframe briefly (same task) so clipped newsletters lay out fully,
 * then restore inline height before returning.
 */
function measureMailIframeContentHeight(
  iframe: HTMLIFrameElement,
  doc: Document,
): number {
  const previousHeight = iframe.style.height;
  iframe.style.height = `${MAX_IFRAME_HEIGHT}px`;
  void doc.body.offsetHeight;

  const painted = measurePaintedContentHeight(doc);
  const canvas = doc.querySelector(".mail-body-root");
  let max = painted;

  if (canvas instanceof HTMLElement) {
    max = Math.max(max, blockContentHeight(canvas));
    const bodyTop = doc.body.getBoundingClientRect().top;
    max = Math.max(
      max,
      Math.ceil(canvas.getBoundingClientRect().bottom - bodyTop + 8),
    );
  } else {
    max = Math.max(max, blockContentHeight(doc.body));
  }

  iframe.style.height = previousHeight;

  return Math.min(Math.max(max, 80), MAX_IFRAME_HEIGHT);
}

function commitMeasuredHeight(prev: number, next: number): number {
  if (Math.abs(next - prev) <= 1) return prev;
  return next;
}

export function MailHtmlBody({
  html,
  className,
  variant = "reader",
  layout = "fill",
  scrollPaneRef,
}: {
  html: string;
  className?: string;
  variant?: MailIframeVariant;
  /** fill = use panel height + scroll inside iframe; auto = grow iframe with content */
  layout?: MailIframeLayout;
  /** When set with layout auto, wheel over the iframe scrolls this element. */
  scrollPaneRef?: RefObject<HTMLElement | null>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(() => initialIframeHeightEstimate(html.length));
  const rawHtmlLength = html.length;
  const useAutoHeight = layout === "auto";

  const srcDoc = useMemo(
    () => buildMailIframeSrcDoc(html, variant, layout),
    [html, variant, layout],
  );

  useEffect(() => {
    if (!useAutoHeight) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    setHeight(initialIframeHeightEstimate(rawHtmlLength));

    let ro: ResizeObserver | undefined;
    let debounceId: number | undefined;
    const delayedIds: number[] = [];

    const commitHeight = (measured: number) => {
      const pane = scrollPaneRef?.current;
      const scrollTopBefore = pane?.scrollTop ?? 0;
      setHeight((prev) => {
        const merged = commitMeasuredHeight(prev, measured);
        if (pane && merged > prev) {
          requestAnimationFrame(() => {
            if (scrollPaneRef?.current) {
              scrollPaneRef.current.scrollTop = scrollTopBefore;
            }
          });
        }
        return merged;
      });
    };

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.body) return;
        const next = measureMailIframeContentHeight(iframe, doc);
        commitHeight(next);
      } catch {
        /* sandbox */
      }
    };

    const scheduleMeasure = () => {
      if (debounceId !== undefined) {
        window.clearTimeout(debounceId);
      }
      debounceId = window.setTimeout(() => {
        debounceId = undefined;
        measure();
      }, MEASURE_DEBOUNCE_MS);
    };

    const onLoad = () => {
      measure();
      scheduleMeasure();
      delayedIds.push(window.setTimeout(measure, 400));
      delayedIds.push(window.setTimeout(measure, 1200));

      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      ro?.disconnect();
      ro = new ResizeObserver(() => scheduleMeasure());
      const canvas = doc.querySelector(".mail-body-root");
      if (canvas instanceof HTMLElement) {
        ro.observe(canvas);
      } else {
        ro.observe(doc.body);
      }

      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", scheduleMeasure, { once: true });
          img.addEventListener("error", scheduleMeasure, { once: true });
        }
      });
    };

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }

    return () => {
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      delayedIds.forEach((id) => window.clearTimeout(id));
    };
  }, [srcDoc, rawHtmlLength, useAutoHeight, scrollPaneRef]);

  useEffect(() => {
    if (!useAutoHeight || !scrollPaneRef) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let win: Window | null = null;

    const onWheel = (event: WheelEvent) => {
      const pane = scrollPaneRef.current;
      if (!pane || pane.scrollHeight <= pane.clientHeight + 1) return;

      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const docEl = doc.documentElement;
          const innerMax = Math.max(
            0,
            docEl.scrollHeight - docEl.clientHeight,
          );
          if (innerMax > 2) {
            if (event.deltaY > 0 && docEl.scrollTop < innerMax) return;
            if (event.deltaY < 0 && docEl.scrollTop > 0) return;
          }
        }
      } catch {
        /* opaque */
      }

      pane.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
      event.preventDefault();
    };

    const attach = () => {
      detach();
      win = iframe.contentWindow;
      win?.addEventListener("wheel", onWheel, { passive: false });
    };

    const detach = () => {
      win?.removeEventListener("wheel", onWheel);
      win = null;
    };

    iframe.addEventListener("load", attach);
    attach();

    return () => {
      iframe.removeEventListener("load", attach);
      detach();
    };
  }, [srcDoc, useAutoHeight, scrollPaneRef]);

  const iframeEl = (
    <iframe
      ref={iframeRef}
      title="Email message body"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      className={cn(
        "block w-full min-w-0 border-0",
        useAutoHeight ? "min-h-[80px]" : "absolute inset-0 size-full",
        variant === "reader" ? "bg-background" : "bg-white",
      )}
      style={useAutoHeight ? { height } : undefined}
      scrolling="no"
    />
  );

  if (useAutoHeight) {
    return (
      <div className={cn("w-full min-w-0", className)}>{iframeEl}</div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-0 w-full min-w-0 flex-1",
        className,
      )}
    >
      {iframeEl}
    </div>
  );
}
