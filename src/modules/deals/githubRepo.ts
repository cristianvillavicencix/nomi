export type GithubRepoRef = {
  owner: string;
  repo: string;
  slug: string;
};

const GITHUB_HOST_PATTERN = /github\.com/i;

export const parseGithubRepo = (
  input?: string | null,
): GithubRepoRef | null => {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  if (GITHUB_HOST_PATTERN.test(trimmed)) {
    try {
      const url = new URL(
        trimmed.includes("://") ? trimmed : `https://${trimmed}`,
      );
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return null;
      const owner = segments[0];
      const repo = segments[1].replace(/\.git$/i, "");
      if (!owner || !repo) return null;
      return { owner, repo, slug: `${owner}/${repo}` };
    } catch {
      return null;
    }
  }

  const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;

  const [, owner, repo] = match;
  return { owner, repo, slug: `${owner}/${repo}` };
};

export const normalizeGithubRepoInput = (input?: string | null) => {
  const parsed = parseGithubRepo(input);
  return parsed?.slug ?? null;
};

export const getGithubRepoUrl = (input?: string | null) => {
  const parsed = parseGithubRepo(input);
  if (parsed) return `https://github.com/${parsed.slug}`;
  const trimmed = input?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9._-]+\.[A-Za-z]{2,}(\/|$)/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
};

export const getGithubRepoLabel = (input?: string | null) =>
  parseGithubRepo(input)?.slug ?? input?.trim() ?? null;

/** Store owner/repo when parseable; otherwise keep free-text Git URL. */
export const normalizeGitRepoInput = (input?: string | null) => {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  return parseGithubRepo(trimmed)?.slug ?? trimmed;
};

export const optionalGithubRepo = (value?: string) => {
  if (!value?.trim()) return;
  if (!parseGithubRepo(value)) {
    return "Use owner/repo or a github.com URL";
  }
};
