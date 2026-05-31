import * as cheerio from "cheerio";
import type { Page } from "puppeteer-core";

export type RenderedSeoSignals = {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  h1Texts: string[];
  canonical: string | null;
  html: string;
  visibleTextLength: number;
};

export const extractRenderedSeoSignals = async (
  page: Page,
): Promise<RenderedSeoSignals> => {
  const dom = await page.evaluate(() => {
    const metaContent = (selectors: string[]) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        const content = el?.getAttribute("content")?.trim();
        if (content) return content;
      }
      return null;
    };

    const collectHeadings = (): string[] => {
      const seen = new Set<string>();
      const texts: string[] = [];
      const push = (raw: string | null | undefined) => {
        const text = raw?.trim();
        if (!text || text.length < 2 || seen.has(text.toLowerCase())) return;
        seen.add(text.toLowerCase());
        texts.push(text);
      };
      document.querySelectorAll("h1").forEach((node) => push(node.textContent));
      document
        .querySelectorAll("[role='heading'][aria-level='1']")
        .forEach((node) => push(node.textContent));
      return texts;
    };

    const h1Texts = collectHeadings();
    const visibleTextLength =
      document.body?.innerText?.replace(/\s+/g, " ").trim().length ?? 0;

    const title =
      document.title?.trim() ||
      metaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      null;

    const metaDescription =
      metaContent([
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
      ]) || null;

    return {
      title,
      metaDescription,
      h1Count: h1Texts.length,
      h1Text: h1Texts[0] ?? null,
      h1Texts,
      canonical:
        document
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href")
          ?.trim() || null,
      visibleTextLength,
    };
  });

  const html = await page.content();
  const $ = cheerio.load(html);

  const cheerioTitle =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    null;
  const cheerioMeta =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const cheerioH1 = $("h1")
    .map((_i, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h1Texts =
    dom.h1Texts.length > 0
      ? dom.h1Texts
      : cheerioH1.length > 0
        ? cheerioH1
        : [];

  return {
    title: dom.title || cheerioTitle,
    metaDescription: dom.metaDescription || cheerioMeta,
    h1Count: Math.max(dom.h1Count, cheerioH1.length, h1Texts.length),
    h1Text: dom.h1Text || cheerioH1[0] || h1Texts[0] || null,
    h1Texts,
    canonical:
      dom.canonical || $('link[rel="canonical"]').attr("href")?.trim() || null,
    html,
    visibleTextLength: dom.visibleTextLength,
  };
};
