import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { IconButton } from "@/components/ui/icon-button";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  getGithubRepoUrl,
  normalizeGitRepoInput,
} from "@/modules/deals/githubRepo";
import { normalizeDeploymentUrl } from "@/modules/deals/projects/projectDeploymentUrls";
import { SecurityFloatingInput } from "@/modules/deals/projects/securityFloatingFields";
import type { LbsDeal } from "@/modules/types";

export const ProjectOverviewSecurityCard = ({
  record,
}: {
  record: LbsDeal;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [update] = useUpdate();
  const gitHref = getGithubRepoUrl(record.github_repo);

  const [gitRepo, setGitRepo] = useState(record.github_repo ?? "");
  const [stagingUrl, setStagingUrl] = useState(record.staging_url ?? "");
  const [productionUrl, setProductionUrl] = useState(
    record.production_url ?? "",
  );

  useEffect(() => {
    setGitRepo(record.github_repo ?? "");
  }, [record.id, record.github_repo]);

  useEffect(() => {
    setStagingUrl(record.staging_url ?? "");
  }, [record.id, record.staging_url]);

  useEffect(() => {
    setProductionUrl(record.production_url ?? "");
  }, [record.id, record.production_url]);

  const saveFields = (patch: Partial<LbsDeal>) => {
    update(
      "deals",
      {
        id: record.id,
        data: patch,
        previousData: record,
      },
      {
        onSuccess: () => refresh(),
        onError: () =>
          notify("Could not save project details", { type: "error" }),
      },
    );
  };

  const commitUrl = (
    field: "staging_url" | "production_url",
    raw: string,
  ) => {
    const trimmed = raw.trim();
    const next = trimmed ? normalizeDeploymentUrl(trimmed) : null;
    const previous = String(record[field] ?? "").trim() || null;
    if (next === previous) return;
    saveFields({ [field]: next });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Overview</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <SecurityFloatingInput
          id="security-git-repo"
          label="Git repository"
          className="sm:col-span-2"
          value={gitRepo}
          disabled={!canEdit}
          placeholder="owner/repo or https://github.com/…"
          onChange={setGitRepo}
          onBlur={() => {
            if (!canEdit) return;
            const next = normalizeGitRepoInput(gitRepo);
            if (next === (record.github_repo ?? "")) return;
            saveFields({ github_repo: next });
          }}
          trailing={
            gitHref ? (
              <IconButton
                aria-label="Open repository"
                variant="secondary"
                asChild
              >
                <a href={gitHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </IconButton>
            ) : null
          }
        />

        <SecurityFloatingInput
          id="security-staging_url"
          label="Staging URL"
          value={stagingUrl}
          disabled={!canEdit}
          placeholder="staging.example.com"
          onChange={setStagingUrl}
          onBlur={() => {
            if (!canEdit) return;
            commitUrl("staging_url", stagingUrl);
          }}
        />
        <SecurityFloatingInput
          id="security-production_url"
          label="Production URL"
          value={productionUrl}
          disabled={!canEdit}
          placeholder="www.example.com"
          onChange={setProductionUrl}
          onBlur={() => {
            if (!canEdit) return;
            commitUrl("production_url", productionUrl);
          }}
        />
      </div>
    </div>
  );
};
