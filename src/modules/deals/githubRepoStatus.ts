export type GithubRepoCommitStatus = {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  date: string | null;
  url: string;
};

export type GithubRepoRunStatus = {
  status: string | null;
  conclusion: string | null;
  workflow_name: string | null;
  updated_at: string | null;
  url: string | null;
};

export type GithubRepoStatus = {
  slug: string;
  repo_url: string | null;
  default_branch: string | null;
  last_commit: GithubRepoCommitStatus | null;
  latest_run: GithubRepoRunStatus | null;
  github_token_configured: boolean;
  error?: string | null;
};

export const formatGithubStatusDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getGithubRunStatusLabel = (run?: GithubRepoRunStatus | null) => {
  if (!run) return "No recent deploys";
  if (run.status === "in_progress" || run.status === "queued") {
    return "Deploy running";
  }
  if (run.conclusion === "success") return "Deploy passed";
  if (run.conclusion === "failure") return "Deploy failed";
  if (run.conclusion === "cancelled") return "Deploy cancelled";
  if (run.status === "completed") return "Deploy completed";
  return run.workflow_name ?? "Workflow";
};

export const getGithubRunStatusClassName = (
  run?: GithubRepoRunStatus | null,
) => {
  if (!run) return "bg-muted text-muted-foreground";
  if (run.status === "in_progress" || run.status === "queued") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  if (run.conclusion === "success") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (run.conclusion === "failure") {
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  }
  return "bg-muted text-muted-foreground";
};
