import type { PageLinkFound } from "./extractPageLinks.js";

export type PageLinkChecked = PageLinkFound & {
  status: number | null;
  ok: boolean;
  error?: string | null;
};

const DEFAULT_MAX_LINKS = 80;
const DEFAULT_CONCURRENCY = 10;
const LINK_TIMEOUT_MS = 8_000;

const isOkStatus = (status: number) => status >= 200 && status < 400;

const checkOneLink = async (
  link: PageLinkFound,
  signal: AbortSignal,
): Promise<PageLinkChecked> => {
  if (signal.aborted) {
    return { ...link, status: null, ok: false, error: "aborted" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);

  try {
    let response = await fetch(link.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "NomiWebAudit/1.0 (+https://lbs.bz)" },
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(link.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "NomiWebAudit/1.0 (+https://lbs.bz)",
          Range: "bytes=0-0",
        },
      });
    }

    const status = response.status;
    return {
      ...link,
      status,
      ok: isOkStatus(status),
      error: isOkStatus(status) ? null : `HTTP ${status}`,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      ...link,
      status: null,
      ok: false,
      error: message.slice(0, 120),
    };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
};

const runPool = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!);
    }
  });

  await Promise.all(runners);
  return results;
};

export const checkPageLinks = async (
  links: PageLinkFound[],
  signal: AbortSignal,
  options?: { maxLinks?: number; concurrency?: number },
): Promise<{
  links: PageLinkChecked[];
  totalLinks: number;
  brokenLinkCount: number;
  checkedCount: number;
}> => {
  const maxLinks = options?.maxLinks ?? DEFAULT_MAX_LINKS;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const toCheck = links.slice(0, maxLinks);

  const checked = await runPool(toCheck, concurrency, (link) =>
    checkOneLink(link, signal),
  );

  const brokenLinkCount = checked.filter((link) => !link.ok).length;

  return {
    links: checked,
    totalLinks: links.length,
    brokenLinkCount,
    checkedCount: checked.length,
  };
};
