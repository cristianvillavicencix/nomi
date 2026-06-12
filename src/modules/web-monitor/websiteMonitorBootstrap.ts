const DAILY_SYNC_KEY = "web_monitor_daily_sync_date";

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Full company → monitored_websites sync, at most once per calendar day. */
export const shouldRunDailyCompanySync = (): boolean => {
  try {
    return localStorage.getItem(DAILY_SYNC_KEY) !== todayKey();
  } catch {
    return true;
  }
};

export const markDailyCompanySyncDone = () => {
  try {
    localStorage.setItem(DAILY_SYNC_KEY, todayKey());
  } catch {
    // ignore
  }
};
