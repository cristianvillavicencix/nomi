import * as cheerio from "cheerio";
import type { Page } from "puppeteer-core";
import {
  extractPageLinks,
  mergePageLinks,
  type PageLinkFound,
} from "./extractPageLinks.js";

export type PageImageStatus = "ok" | "missing_alt" | "broken";

export type PageImageFound = {
  src: string;
  filename: string | null;
  alt: string | null;
  status: PageImageStatus;
  width: number | null;
  height: number | null;
};

const MAX_IMAGES = 60;

const filenameFromSrc = (src: string) => {
  try {
    const path = new URL(src).pathname;
    return path.split("/").pop()?.split("?")[0] ?? null;
  } catch {
    return src.split("/").pop()?.split("?")[0] ?? null;
  }
};

const classifyImage = (img: {
  src: string;
  alt: string | null;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
}): PageImageStatus => {
  if (!img.src) return "broken";
  const hasAlt = Boolean(img.alt?.trim());
  const loaded =
    img.complete &&
    img.naturalWidth > 0 &&
    img.naturalHeight > 0;
  if (!loaded) return "broken";
  if (!hasAlt) return "missing_alt";
  return "ok";
};

/** Scroll briefly so lazy-loaded images/links enter the DOM. */
const triggerLazyContent = async (page: Page) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const maxScroll = Math.min(document.body.scrollHeight, 8000);
      let scrolled = 0;
      const step = 500;
      const tick = () => {
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled >= maxScroll) {
          window.scrollTo(0, 0);
          resolve();
          return;
        }
        setTimeout(tick, 80);
      };
      tick();
      setTimeout(() => {
        window.scrollTo(0, 0);
        resolve();
      }, 2500);
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
};

export const extractRenderedPageContent = async (
  page: Page,
  pageOrigin: string,
): Promise<{ links: PageLinkFound[]; images: PageImageFound[] }> => {
  await triggerLazyContent(page);

  const raw = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]")).map((node) => {
      const anchor = node as HTMLAnchorElement;
      return {
        href: anchor.href,
        text:
          anchor.textContent?.trim() ||
          anchor.getAttribute("aria-label")?.trim() ||
          anchor.getAttribute("title")?.trim() ||
          null,
      };
    });

    const images = Array.from(document.querySelectorAll("img")).map((node) => {
      const img = node as HTMLImageElement;
      return {
        src: img.currentSrc || img.src || "",
        alt: img.getAttribute("alt"),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      };
    });

    return { links, images };
  });

  const html = await page.content();
  const $ = cheerio.load(html);
  const staticLinks = extractPageLinks($, pageOrigin);
  const links = mergePageLinks(
    pageOrigin,
    staticLinks,
    raw.links.map((link) => ({
      url: link.href,
      text: link.text,
      isInternal: false,
    })),
  );

  const seenImages = new Set<string>();
  const images: PageImageFound[] = [];

  for (const img of raw.images) {
    if (!img.src || seenImages.has(img.src)) continue;
    seenImages.add(img.src);

    images.push({
      src: img.src,
      filename: filenameFromSrc(img.src),
      alt: img.alt,
      status: classifyImage(img),
      width: img.naturalWidth || null,
      height: img.naturalHeight || null,
    });

    if (images.length >= MAX_IMAGES) break;
  }

  return { links, images };
};

export const summarizePageImages = (images: PageImageFound[]) => {
  const totalImages = images.length;
  const imagesWithoutAlt = images.filter((img) => img.status === "missing_alt").length;
  const brokenImages = images.filter((img) => img.status === "broken").length;
  const imagesOk = images.filter((img) => img.status === "ok").length;

  return {
    totalImages,
    imagesWithoutAlt,
    brokenImages,
    imagesOk,
    pageImages: images,
    imagesMissingAlt: images
      .filter((img) => img.status === "missing_alt" || img.status === "broken")
      .map((img) => ({ src: img.src, filename: img.filename })),
  };
};
