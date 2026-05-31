export type CrawlFileFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<{ status: number; text: string } | null>;

export type CrawlResourceAccess = "found" | "missing" | "blocked" | "error";
export type CrawlResourceSource = "fetch" | "browser" | "merged";

const BLOCK_STATUSES = new Set([403, 429, 503, 520, 521, 522, 523]);

export type ResolvedCrawlResource = {
  url: string;
  status: number | null;
  fetchStatus: number | null;
  browserStatus: number | null;
  access: CrawlResourceAccess;
  source: CrawlResourceSource;
  content: string | null;
  found: boolean;
};

export const resolveCrawlResource = async (
  url: string,
  signal: AbortSignal,
  fetchers: {
    datacenter?: CrawlFileFetcher;
    browser?: CrawlFileFetcher;
  },
  isValidContent: (text: string) => boolean,
): Promise<ResolvedCrawlResource> => {
  const empty: ResolvedCrawlResource = {
    url,
    status: null,
    fetchStatus: null,
    browserStatus: null,
    access: "missing",
    source: "fetch",
    content: null,
    found: false,
  };

  let fetchStatus: number | null = null;
  let browserStatus: number | null = null;
  let fetchBlocked = false;
  let fetchContent: string | null = null;

  if (fetchers.datacenter) {
    const res = await fetchers.datacenter(url, signal);
    fetchStatus = res?.status ?? null;
    if (res && res.status >= 200 && res.status < 400 && isValidContent(res.text)) {
      fetchContent = res.text;
    } else if (res && BLOCK_STATUSES.has(res.status)) {
      fetchBlocked = true;
    }
  }

  if (fetchContent) {
    return {
      url,
      status: fetchStatus,
      fetchStatus,
      browserStatus: null,
      access: "found",
      source: "fetch",
      content: fetchContent,
      found: true,
    };
  }

  let browserContent: string | null = null;
  if (fetchers.browser) {
    const res = await fetchers.browser(url, signal);
    browserStatus = res?.status ?? null;
    if (res && res.status >= 200 && res.status < 400 && isValidContent(res.text)) {
      browserContent = res.text;
    }
  }

  if (browserContent) {
    return {
      url,
      status: browserStatus,
      fetchStatus,
      browserStatus,
      access: "found",
      source: fetchBlocked || (fetchStatus != null && fetchStatus >= 400) ? "browser" : "browser",
      content: browserContent,
      found: true,
    };
  }

  if (fetchBlocked) {
    return {
      ...empty,
      fetchStatus,
      browserStatus,
      status: fetchStatus ?? browserStatus,
      access: "blocked",
      source: "fetch",
    };
  }

  if (fetchStatus != null && fetchStatus >= 400) {
    return {
      ...empty,
      fetchStatus,
      browserStatus,
      status: fetchStatus,
      access: "error",
    };
  }

  if (browserStatus != null && browserStatus >= 400) {
    return {
      ...empty,
      fetchStatus,
      browserStatus,
      status: browserStatus,
      access: browserStatus === 404 ? "missing" : "error",
      source: "browser",
    };
  }

  return {
    ...empty,
    fetchStatus,
    browserStatus,
    status: fetchStatus ?? browserStatus,
  };
};

export const mergeResolvedResource = (
  datacenter: ResolvedCrawlResource,
  browser: ResolvedCrawlResource,
): ResolvedCrawlResource => {
  const pick = browser.found ? browser : datacenter.found ? datacenter : browser.access === "blocked" && !datacenter.found ? browser : datacenter.access === "blocked" ? datacenter : browser.status != null ? browser : datacenter;

  if (datacenter.found && browser.found) {
    return {
      ...browser,
      fetchStatus: datacenter.fetchStatus,
      browserStatus: browser.browserStatus,
      source: "merged",
    };
  }

  if (browser.found && !datacenter.found) {
    return {
      ...browser,
      fetchStatus: datacenter.fetchStatus,
      source: datacenter.access === "blocked" ? "browser" : "browser",
    };
  }

  if (datacenter.found) return datacenter;

  if (datacenter.access === "blocked" || browser.access === "blocked") {
    return {
      ...pick,
      access: "blocked",
      fetchStatus: datacenter.fetchStatus ?? browser.fetchStatus,
      browserStatus: browser.browserStatus ?? datacenter.browserStatus,
      status: datacenter.fetchStatus ?? browser.fetchStatus ?? browser.status,
    };
  }

  return pick;
};
