import { ExternalLink, Github, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getGithubRepoLabel, getGithubRepoUrl } from "@/lbs/deals/githubRepo";
import {
  formatGithubStatusDate,
  getGithubRunStatusClassName,
  getGithubRunStatusLabel,
} from "@/lbs/deals/githubRepoStatus";
import { useGithubRepoStatus } from "@/lbs/deals/useGithubRepoStatus";
import type { Deal } from "@/components/atomic-crm/types";

export const ProjectGithubLink = ({
  record,
  showEditLink = false,
}: {
  record: Pick<Deal, "id" | "github_repo">;
  showEditLink?: boolean;
}) => {
  const label = getGithubRepoLabel(record.github_repo);
  const href = getGithubRepoUrl(record.github_repo);
  const {
    data: status,
    isLoading,
    isError,
  } = useGithubRepoStatus(record.id, record.github_repo);

  const repoUrl = status?.repo_url ?? href;
  const repoLabel = status?.slug ?? label;
  const runLabel = getGithubRunStatusLabel(status?.latest_run);
  const runClassName = getGithubRunStatusClassName(status?.latest_run);

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Github className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">GitHub repository</h3>
        </div>
        {showEditLink ? (
          <Link to={`/deals/${record.id}`} className="text-sm link-action">
            Edit
          </Link>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Repository</TableHead>
            <TableHead className="w-[120px]">Branch</TableHead>
            <TableHead>Latest commit</TableHead>
            <TableHead className="w-[160px]">Deploy</TableHead>
            <TableHead className="w-[120px]">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!label || !href ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-6 text-sm text-muted-foreground"
              >
                No repository linked to this project yet.
                {showEditLink ? (
                  <>
                    {" "}
                    <Link to={`/deals/${record.id}`} className="link-action">
                      Add repository
                    </Link>
                  </>
                ) : null}
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading repository status…
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell className="font-medium">
                <a
                  href={repoUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 link-action"
                >
                  <span className="truncate">{repoLabel}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {status?.default_branch ?? "—"}
              </TableCell>
              <TableCell>
                {isError || status?.error ? (
                  <span className="text-sm text-muted-foreground">
                    {status?.error ?? "Could not load commit info"}
                  </span>
                ) : status?.last_commit ? (
                  <a
                    href={status.last_commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-w-0 link-action"
                  >
                    <span className="font-mono text-xs">
                      {status.last_commit.short_sha}
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="truncate text-sm">
                      {status.last_commit.message}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {status.last_commit.author}
                    </span>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No commits found
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge
                    variant="secondary"
                    className={cn("w-fit", runClassName)}
                  >
                    {runLabel}
                  </Badge>
                  {status?.latest_run?.url ? (
                    <a
                      href={status.latest_run.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs link-action"
                    >
                      View workflow
                    </a>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatGithubStatusDate(status?.latest_run?.updated_at) ??
                  formatGithubStatusDate(status?.last_commit?.date) ??
                  "—"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {status && !status.github_token_configured && label ? (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Set `GITHUB_TOKEN` in Supabase secrets to read private repos reliably.
        </p>
      ) : null}
    </div>
  );
};
