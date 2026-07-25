import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCalendarFeedUrls } from "./calendarFeedUrls";

describe("buildCalendarFeedUrls", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  });

  it("builds https and webcal URLs from the Supabase functions base", () => {
    const urls = buildCalendarFeedUrls("abc123");
    expect(urls.feed_url).toBe(
      "https://test.supabase.co/functions/v1/calendar_feed?token=abc123",
    );
    expect(urls.webcal_url).toBe(
      "webcal://test.supabase.co/functions/v1/calendar_feed?token=abc123",
    );
  });
});
