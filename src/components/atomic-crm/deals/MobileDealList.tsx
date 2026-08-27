import { useEffect, useMemo, useState } from "react";
import {
  useGetIdentity,
  useGetMany,
  useListContext,
  useListFilterContext,
} from "ra-core";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProjectDeliveryCountdownText } from "@/modules/deals/ProjectDeliveryCountdownText";
import { getNewDealManualCreatePath } from "@/modules/deals/projectCreatePaths";
import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Deal } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";
import { MobilePageChrome } from "../layout/MobilePageChrome";
import { ModuleSearchField } from "../layout/ModuleToolbar";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";

export const MobileDealListContent = () => {
  const { data: deals = [], isPending } = useListContext<Deal>();
  const config = useConfigurationContext();

  const companyIds = useMemo(
    () =>
      Array.from(new Set(deals.map((deal) => deal.company_id).filter(Boolean))),
    [deals],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companiesById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company])),
    [companies],
  );

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!deals.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-2 text-center">
        <h3 className="text-lg font-semibold">No projects found</h3>
        <p className="text-sm text-muted-foreground">
          Try another search or create a new project.
        </p>
        <Link
          to={getNewDealManualCreatePath()}
          className={buttonVariants({ variant: "primary" })}
        >
          New Project
        </Link>
      </div>
    );
  }

  return (
    <ul className="glass-grouped overflow-hidden rounded-xl">
      {deals.map((deal) => {
        const company = companiesById[deal.company_id];
        const stageColor = getStageColor(
          config,
          deal.stage,
          deal.pipeline_id,
        );
        return (
          <li key={deal.id}>
            <Link
              to={`/deals/${deal.id}/show`}
              className={cn(
                "flex flex-col gap-1.5 px-4 py-3.5 transition-colors",
                "hover:bg-muted/40 active:bg-muted/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-foreground">
                  {deal.name || "—"}
                </span>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px]"
                  style={{
                    backgroundColor: `${stageColor}22`,
                    borderColor: stageColor,
                  }}
                >
                  {getStageLabel(config, deal.stage, deal.pipeline_id)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="min-w-0 truncate">
                  {company?.name ?? "No company"}
                </span>
                <ProjectDeliveryCountdownText
                  record={deal}
                  className="shrink-0 text-xs"
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const MobileDealSearchField = () => {
  const { total } = useListContext();
  const { filterValues, setFilters } = useListFilterContext();
  const [searchDraft, setSearchDraft] = useState(
    () => String(filterValues?.q ?? ""),
  );

  useEffect(() => {
    setSearchDraft(String(filterValues?.q ?? ""));
  }, [filterValues?.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchDraft.trim();
      const current = String(filterValues?.q ?? "").trim();
      if (next === current) return;
      const nextFilters = { ...filterValues };
      if (next) nextFilters.q = next;
      else delete nextFilters.q;
      setFilters(nextFilters, undefined, false);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, filterValues, setFilters]);

  return (
    <ModuleSearchField
      value={searchDraft}
      onChange={setSearchDraft}
      basePlaceholder="Search projects"
      total={total}
      itemSingular="project"
      className="w-full"
    />
  );
};

export const MobileDealListLayout = () => {
  const { data: identity } = useGetIdentity();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");

  return (
    <MobilePageChrome
      title="Projects"
      action={
        canManageSales ? (
          <IconButton aria-label="New project" asChild>
            <Link to={getNewDealManualCreatePath()}>
              <Plus className="size-6" />
            </Link>
          </IconButton>
        ) : undefined
      }
      search={<MobileDealSearchField />}
    >
      <MobileDealListContent />
    </MobilePageChrome>
  );
};
