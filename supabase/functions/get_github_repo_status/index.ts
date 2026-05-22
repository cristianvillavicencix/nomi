import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";

type GetGithubRepoStatusBody = {
  deal_id?: number;
};

type GithubRepoRef = {
  owner: string;
  repo: string;
  slug: string;
};

const parseGithubRepo = (input?: string | null): GithubRepoRef | null => {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  if (/github\.com/i.test(trimmed)) {
    try {
      const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
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

const githubFetch = async (path: string, token?: string | null) => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Nomi-CRM",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json();
};

const fetchGithubRepoStatus = async (slugInput: string, token?: string | null) => {
  const parsed = parseGithubRepo(slugInput);
  if (!parsed) {
    throw new Error("Invalid GitHub repository");
  }

  const { owner, repo, slug } = parsed;
  const repoUrl = `https://github.com/${slug}`;

  const repoData = await githubFetch(`/repos/${owner}/${repo}`, token);
  const defaultBranch = typeof repoData.default_branch === "string"
    ? repoData.default_branch
    : "main";

  let lastCommit: Record<string, unknown> | null = null;
  try {
    const commits = await githubFetch(
      `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
      token,
    );
    const commit = Array.isArray(commits) ? commits[0] : null;
    if (commit?.sha) {
      const message = String(commit.commit?.message ?? "").split("\n")[0].trim();
      lastCommit = {
        sha: commit.sha,
        short_sha: String(commit.sha).slice(0, 7),
        message: message || "Commit",
        author:
          commit.commit?.author?.name ??
          commit.author?.login ??
          "Unknown",
        date: commit.commit?.author?.date ?? null,
        url: commit.html_url ?? `${repoUrl}/commit/${commit.sha}`,
      };
    }
  } catch (error) {
    console.warn("get_github_repo_status.commits", error);
  }

  let latestRun: Record<string, unknown> | null = null;
  try {
    const runs = await githubFetch(
      `/repos/${owner}/${repo}/actions/runs?per_page=1`,
      token,
    );
    const run = runs?.workflow_runs?.[0];
    if (run?.id) {
      latestRun = {
        status: run.status ?? null,
        conclusion: run.conclusion ?? null,
        workflow_name: run.name ?? null,
        updated_at: run.updated_at ?? run.run_started_at ?? null,
        url: run.html_url ?? null,
      };
    }
  } catch (error) {
    console.warn("get_github_repo_status.actions", error);
  }

  return {
    slug,
    repo_url: repoUrl,
    default_branch: defaultBranch,
    last_commit: lastCommit,
    latest_run: latestRun,
    github_token_configured: Boolean(token),
  };
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        try {
          if (!user?.id) {
            return createErrorResponse(401, "Unauthorized");
          }

          const member = await getUserOrganizationMember(user);
          if (!member?.org_id) {
            return createErrorResponse(401, "Unauthorized");
          }

          const body = (await req.json()) as GetGithubRepoStatusBody;
          const dealId = Number(body.deal_id);
          if (!Number.isFinite(dealId)) {
            return createErrorResponse(400, "Invalid deal_id");
          }

          const { data: deal, error: dealError } = await supabaseAdmin
            .from("deals")
            .select("id, github_repo")
            .eq("id", dealId)
            .eq("org_id", member.org_id)
            .maybeSingle();

          if (dealError || !deal?.id) {
            return createErrorResponse(404, "Project not found");
          }

          if (!deal.github_repo?.trim()) {
            return createErrorResponse(400, "Project has no GitHub repository linked");
          }

          const token = Deno.env.get("GITHUB_TOKEN")?.trim() || null;

          try {
            const status = await fetchGithubRepoStatus(deal.github_repo, token);
            return new Response(JSON.stringify(status), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (error) {
            const parsed = parseGithubRepo(deal.github_repo);
            return new Response(
              JSON.stringify({
                slug: parsed?.slug ?? deal.github_repo,
                repo_url: parsed ? `https://github.com/${parsed.slug}` : null,
                default_branch: null,
                last_commit: null,
                latest_run: null,
                github_token_configured: Boolean(token),
                error: error instanceof Error ? error.message : "Failed to load GitHub status",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        } catch (error) {
          console.error("get_github_repo_status.error", error);
          return createErrorResponse(
            500,
            error instanceof Error ? error.message : "Unexpected error",
          );
        }
      }),
    ),
  ),
);
