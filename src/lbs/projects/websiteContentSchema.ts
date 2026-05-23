/**
 * Website page content model stored in deals.website_content (jsonb).
 */
export type WebsiteContentPage = {
  id: string;
  slug: string;
  title: string;
  client_text?: string | null;
  internal_notes?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  target_keyword?: string | null;
  cta?: string | null;
  status?: "draft" | "client_review" | "approved" | "revision_requested";
  approval?: {
    approved_at?: string | null;
    approved_by_member_id?: number | null;
    revision_requested_at?: string | null;
    revision_notes?: string | null;
  };
};

export type WebsiteContent = {
  pages?: WebsiteContentPage[];
};

export const DEFAULT_WEBSITE_CONTENT_PAGES: WebsiteContentPage[] = [
  { id: "home", slug: "home", title: "Home", status: "draft" },
  { id: "about", slug: "about", title: "About", status: "draft" },
  { id: "services", slug: "services", title: "Services", status: "draft" },
  { id: "contact", slug: "contact", title: "Contact", status: "draft" },
];

export const parseWebsiteContent = (raw: unknown): WebsiteContent => {
  if (!raw || typeof raw !== "object")
    return { pages: [...DEFAULT_WEBSITE_CONTENT_PAGES] };
  const pages = (raw as WebsiteContent).pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return { pages: [...DEFAULT_WEBSITE_CONTENT_PAGES] };
  }
  return { pages };
};

export const approveContentPage = (
  content: WebsiteContent,
  pageId: string,
  memberId?: number | null,
): WebsiteContent => ({
  pages: (content.pages ?? []).map((page) =>
    page.id === pageId
      ? {
          ...page,
          status: "approved",
          approval: {
            ...page.approval,
            approved_at: new Date().toISOString(),
            approved_by_member_id: memberId ?? null,
            revision_requested_at: null,
            revision_notes: null,
          },
        }
      : page,
  ),
});

export const requestContentRevision = (
  content: WebsiteContent,
  pageId: string,
  notes: string,
): WebsiteContent => ({
  pages: (content.pages ?? []).map((page) =>
    page.id === pageId
      ? {
          ...page,
          status: "revision_requested",
          approval: {
            ...page.approval,
            revision_requested_at: new Date().toISOString(),
            revision_notes: notes,
            approved_at: null,
          },
        }
      : page,
  ),
});
