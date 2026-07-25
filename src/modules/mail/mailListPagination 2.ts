export const MAIL_THREADS_DEFAULT_PER_PAGE = 25;
export const MAIL_THREADS_PER_PAGE_OPTIONS = [25, 50, 100] as const;

export type MailThreadsPageResult = {
  threads: import("./types").MailThread[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function mailThreadsPageRange(page: number, perPage: number) {
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;
  return { from, to, page: safePage, perPage: safePerPage };
}

export function buildMailThreadsPageResult(params: {
  threads: import("./types").MailThread[];
  total: number | null;
  page: number;
  perPage: number;
}): MailThreadsPageResult {
  const { from, to, page, perPage } = mailThreadsPageRange(
    params.page,
    params.perPage,
  );
  const total = params.total ?? params.threads.length;
  return {
    threads: params.threads,
    total,
    page,
    perPage,
    hasNextPage: total > to + 1,
    hasPreviousPage: page > 1,
  };
}

export function mailThreadsPageLabel(result: MailThreadsPageResult): string {
  if (result.total <= 0) return "No conversations";
  const start = (result.page - 1) * result.perPage + 1;
  const end = Math.min(result.page * result.perPage, result.total);
  return `${start}–${end} of ${result.total}`;
}
