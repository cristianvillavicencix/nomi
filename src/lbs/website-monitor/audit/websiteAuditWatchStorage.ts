const STORAGE_KEY = "nomi.website-audit-watches";
const WATCH_EVENT = "website-audit-watch-changed";

export type WebsiteAuditWatch = {
  auditId: number;
  siteId: number;
  siteLabel: string;
  requestedAt: string;
};

const readRaw = (): WebsiteAuditWatch[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebsiteAuditWatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRaw = (watches: WebsiteAuditWatch[]) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
  window.dispatchEvent(new CustomEvent(WATCH_EVENT));
};

export const getWebsiteAuditWatches = () => readRaw();

export const registerWebsiteAuditWatch = (watch: WebsiteAuditWatch) => {
  const watches = readRaw();
  const index = watches.findIndex((row) => row.auditId === watch.auditId);
  if (index >= 0) {
    watches[index] = watch;
  } else {
    watches.push(watch);
  }
  writeRaw(watches);
};

export const removeWebsiteAuditWatch = (auditId: number) => {
  writeRaw(readRaw().filter((row) => row.auditId !== auditId));
};

export const subscribeWebsiteAuditWatches = (listener: () => void) => {
  const handler = () => listener();
  window.addEventListener(WATCH_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(WATCH_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
};
