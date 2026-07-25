import type { LbsDeal } from "@/modules/types";

const readBriefString = (
  brief: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = brief?.[key];
  if (value == null) return "";
  return String(value).trim();
};

export const normalizeDeploymentUrl = (value?: string | null) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^www\./i, "")}`;
};

/** Best production/live URL from brief fields (not the deal column). */
export const getBriefProductionUrl = (
  brief?: Record<string, unknown> | null,
) => {
  const existing = readBriefString(brief, "existing_website");
  if (existing) return normalizeDeploymentUrl(existing);

  const domain = readBriefString(brief, "domain");
  if (domain) return normalizeDeploymentUrl(domain);

  return "";
};

export const getBriefStagingUrl = (brief?: Record<string, unknown> | null) =>
  normalizeDeploymentUrl(readBriefString(brief, "staging_url"));

export type ResolvedProjectDeploymentUrls = {
  productionUrl: string;
  stagingUrl: string;
  productionFromBrief: boolean;
  stagingFromBrief: boolean;
};

export const resolveProjectDeploymentUrls = (
  record: Pick<LbsDeal, "production_url" | "staging_url" | "website_brief">,
): ResolvedProjectDeploymentUrls => {
  const brief =
    record.website_brief && typeof record.website_brief === "object"
      ? (record.website_brief as Record<string, unknown>)
      : {};

  const storedProduction = String(record.production_url ?? "").trim();
  const storedStaging = String(record.staging_url ?? "").trim();
  const briefProduction = getBriefProductionUrl(brief);
  const briefStaging = getBriefStagingUrl(brief);

  return {
    productionUrl: storedProduction || briefProduction,
    stagingUrl: storedStaging || briefStaging,
    productionFromBrief: !storedProduction && Boolean(briefProduction),
    stagingFromBrief: !storedStaging && Boolean(briefStaging),
  };
};

/** When saving the brief, copy URL fields onto the deal if deployment columns are empty. */
export const deploymentUrlPatchFromBrief = (
  record: Pick<LbsDeal, "production_url" | "staging_url">,
  brief: Record<string, unknown>,
): Partial<Pick<LbsDeal, "production_url" | "staging_url">> => {
  const patch: Partial<Pick<LbsDeal, "production_url" | "staging_url">> = {};

  if (!String(record.production_url ?? "").trim()) {
    const production = getBriefProductionUrl(brief);
    if (production) patch.production_url = production;
  }

  if (!String(record.staging_url ?? "").trim()) {
    const staging = getBriefStagingUrl(brief);
    if (staging) patch.staging_url = staging;
  }

  return patch;
};
