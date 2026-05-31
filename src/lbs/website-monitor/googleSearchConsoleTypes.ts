export type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSearchAnalyticsSnapshot = {
  id: number;
  org_id: number;
  monitored_website_id: number;
  site_url: string;
  period_start: string;
  period_end: string;
  totals: GscTotals;
  top_queries: GscQueryRow[];
  top_pages: GscPageRow[];
  fetched_at: string;
};

export type GoogleGscStatus = {
  ok?: boolean;
  connected: boolean;
  google_email?: string | null;
  last_synced_at?: string | null;
  snapshot_count?: number;
};
