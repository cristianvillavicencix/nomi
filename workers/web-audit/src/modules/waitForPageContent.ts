import type { Page } from "puppeteer-core";

/**
 * Espera a que el DOM tenga contenido visible — agnóstico al stack
 * (React, WordPress, Shopify, Webflow, PHP, etc.).
 */
export const waitForPageContent = async (page: Page, timeoutMs = 8_000) => {
  try {
    await Promise.race([
      page.waitForFunction(
        () => {
          const bodyText =
            document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
          if (bodyText.length >= 120) return true;

          const h1 = document.querySelector("h1")?.textContent?.trim();
          if (h1 && h1.length >= 3) return true;

          const main =
            document.querySelector("main, [role='main'], #main, .main-content")
              ?.textContent?.trim() ?? "";
          if (main.length >= 80) return true;

          const title = document.title?.trim();
          if (title && title.length >= 5) return true;

          return false;
        },
        { timeout: timeoutMs },
      ),
      page.waitForSelector("h1, main, [role='main'], title", {
        timeout: timeoutMs,
      }),
    ]);
  } catch {
    // Timeout — seguimos con lo que haya cargado
  }

  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
};
