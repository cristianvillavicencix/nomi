import * as cheerio from "cheerio";
import type { Page } from "puppeteer-core";
import { extractSocialLinks } from "./extractSocialLinks.js";

/**
 * Extract social links from the post-JavaScript DOM (stack-agnostic).
 * Uses the same cheerio pipeline as static analysis on rendered HTML.
 */
export const extractRenderedSocialLinks = async (
  page: Page,
  pageOrigin: string,
) => {
  const html = await page.content();
  const $ = cheerio.load(html);
  return extractSocialLinks($, pageOrigin);
};
