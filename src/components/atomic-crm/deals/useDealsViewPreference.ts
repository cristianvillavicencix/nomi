import { useCallback, useMemo } from "react";
import { useDataProvider } from "ra-core";
import { useSearchParams } from "react-router";

import type { CrmDataProvider } from "../providers/types";
import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";

export type DealsViewMode = "board" | "list";

const DEALS_VIEW_KEY = "projects_view";

const isDealsViewMode = (value: string | null): value is DealsViewMode =>
  value === "board" || value === "list";

export const useDealsViewPreference = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const configuration = useConfigurationContext();
  const updateConfiguration = useConfigurationUpdater();

  const view = useMemo<DealsViewMode>(() => {
    const queryValue = searchParams.get("view");
    if (isDealsViewMode(queryValue)) {
      return queryValue;
    }

    if (isDealsViewMode(configuration.projectsView ?? null)) {
      return configuration.projectsView;
    }

    if (typeof window !== "undefined") {
      const storedValue = window.localStorage.getItem(DEALS_VIEW_KEY);
      if (isDealsViewMode(storedValue)) {
        return storedValue;
      }
    }

    return "board";
  }, [configuration.projectsView, searchParams]);

  const setView = useCallback(
    (nextView: DealsViewMode) => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("view", nextView);
      setSearchParams(nextSearchParams, { replace: true });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEALS_VIEW_KEY, nextView);
      }

      const nextConfiguration = {
        ...configuration,
        projectsView: nextView,
      };

      updateConfiguration(nextConfiguration);
      void dataProvider.updateConfiguration(nextConfiguration).catch(() => {
        // Non-admin users may not be allowed to persist configuration.
      });
    },
    [
      configuration,
      dataProvider,
      searchParams,
      setSearchParams,
      updateConfiguration,
    ],
  );

  return { view, setView };
};
