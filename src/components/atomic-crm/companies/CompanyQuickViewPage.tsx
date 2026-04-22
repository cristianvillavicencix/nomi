import { useEffect, useMemo, useState } from "react";
import { ShowBase, useGetList, useStore } from "ra-core";
import { useNavigate, useParams } from "react-router";
import type { Company } from "../types";
import { QuickMasterDetailLayout, type QuickNavItem } from "../layout/QuickMasterDetailLayout";
import { CompanyShowContent } from "./CompanyShow";
import { useConfigurationContext } from "../root/ConfigurationContext";

const normalize = (value?: string | null) => String(value ?? "").trim().toLowerCase();

export const CompanyQuickViewPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useStore<boolean>(
    "companies-quicknav-collapsed",
    false,
  );
  const [lastSelectedId, setLastSelectedId] = useStore<string | null>(
    "companies-quicknav-last-selected",
    null,
  );
  const { companySectors } = useConfigurationContext();

  const { data: companies = [], isPending } = useGetList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const items = useMemo<QuickNavItem[]>(
    () =>
      companies.map((company) => {
        const sectorLabel = companySectors.find((item) => item.value === company.sector)?.label;
        return {
          id: String(company.id),
          title: company.name ?? "Unnamed company",
          subtitle: sectorLabel ?? undefined,
          meta: company.city ?? undefined,
        };
      }),
    [companies, companySectors],
  );

  const filteredItems = useMemo(() => {
    const term = normalize(query);
    if (!term) return items;
    return items.filter((item) =>
      [item.title, item.subtitle, item.meta].some((field) => normalize(field).includes(term)),
    );
  }, [items, query]);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const selectedId = id && itemIds.has(String(id)) ? String(id) : null;

  useEffect(() => {
    if (selectedId) {
      setLastSelectedId(selectedId);
      return;
    }
    if (isPending || items.length === 0) return;
    const fallbackId =
      (lastSelectedId && itemIds.has(lastSelectedId) ? lastSelectedId : null) ?? items[0]?.id;
    if (!fallbackId) return;
    navigate(`/companies/${fallbackId}/show`, { replace: true });
  }, [selectedId, isPending, items, itemIds, lastSelectedId, navigate, setLastSelectedId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <QuickMasterDetailLayout
        sidebarTitle="Companies"
        sidebarSubtitle="Quick navigation for companies"
        searchPlaceholder={`Search companies (${items.length})`}
        mobileBrowseLabel="Browse companies"
        items={filteredItems}
        selectedId={selectedId}
        query={query}
        onQueryChange={setQuery}
        onSelect={(nextId) => {
          setLastSelectedId(nextId);
          navigate(`/companies/${nextId}/show`);
        }}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        isLoading={isPending}
        scrollStorageKey="companies-quicknav-scroll-top"
      >
        <div className="h-full min-h-0 overflow-y-auto">
          {selectedId ? (
            <ShowBase resource="companies" id={selectedId}>
              <CompanyShowContent />
            </ShowBase>
          ) : null}
        </div>
      </QuickMasterDetailLayout>
    </div>
  );
};
