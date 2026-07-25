export type CalendarFeedUrls = {
  token: string;
  feed_url: string;
  webcal_url: string;
};

export const buildCalendarFeedUrls = (token: string): Omit<CalendarFeedUrls, "token"> => {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("VITE_SUPABASE_URL is not configured");
  }

  const feedUrl = `${base}/functions/v1/calendar_feed?token=${encodeURIComponent(token)}`;
  return {
    feed_url: feedUrl,
    webcal_url: feedUrl.replace(/^https?:/i, "webcal:"),
  };
};
