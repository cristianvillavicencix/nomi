import { useEffect, useMemo, useState } from "react";
import { ShowBase, useGetList, useStore } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import type { Person } from "@/components/atomic-crm/types";
import { getPersonDisplayName } from "./constants";
import { PeopleProfileDetailsContent } from "./PeopleShow";
import { PeopleDetailLayout } from "./quick-nav/people-detail-layout";
import type { PeopleQuickNavItem, PeopleQuickNavType } from "./quick-nav/types";
import { useMatch, useNavigate, useParams } from "react-router";

type PeopleQuickViewPageProps = {
  type: PeopleQuickNavType;
};

const quickGroupByType: Record<PeopleQuickNavType, string> = {
  employee: "employees",
  salesperson: "salespeople",
  subcontractor: "subcontractors",
};

const titleByType: Record<PeopleQuickNavType, string> = {
  employee: "Employees",
  salesperson: "Salespeople",
  subcontractor: "Subcontractors",
};

const normalize = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const toQuickItem = (person: Person): PeopleQuickNavItem => {
  const displayName =
    person.type === "subcontractor"
      ? (person.business_name ?? "").trim() ||
        getPersonDisplayName(person) ||
        "Unnamed subcontractor"
      : getPersonDisplayName(person) || "Unnamed person";

  return {
    id: String(person.id),
    type: person.type,
    firstName: person.first_name ?? "",
    lastName: person.last_name ?? "",
    fullName: getPersonDisplayName(person),
    businessName: person.business_name ?? undefined,
    displayName,
    specialty: person.specialty ?? undefined,
    email: person.email ?? undefined,
    phone: person.phone ?? undefined,
    status: person.status === "inactive" ? "inactive" : "active",
  };
};

const filterItems = (items: PeopleQuickNavItem[], term: string, type: PeopleQuickNavType) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return items;

  return items.filter((item) => {
    const commonFields = [
      item.firstName,
      item.lastName,
      item.fullName,
      item.displayName,
      item.email,
      item.phone,
    ];
    const subcontractorFields =
      type === "subcontractor" ? [item.businessName, item.specialty] : [];
    return [...commonFields, ...subcontractorFields].some((field) =>
      normalize(field).includes(normalizedTerm),
    );
  });
};

export const PeopleQuickViewPage = ({ type }: PeopleQuickViewPageProps) => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useStore<boolean>(
    `people-${type}-quicknav-collapsed`,
    false,
  );
  const [lastSelectedId, setLastSelectedId] = useStore<string | null>(
    `people-${type}-quicknav-last-selected`,
    null,
  );

  const group = quickGroupByType[type];
  const tabMatch = useMatch(`/people/${group}/:id/:tab`);
  const activeTab = tabMatch?.params.tab;

  const { data: people = [], isPending } = useGetList<Person>(
    "people",
    {
      pagination: { page: 1, perPage: 500 },
      sort: {
        field: type === "subcontractor" ? "business_name" : "first_name",
        order: "ASC",
      },
      filter: { type },
    },
    { staleTime: 30_000 },
  );

  const items = useMemo(() => people.map(toQuickItem), [people]);
  const filteredItems = useMemo(() => filterItems(items, query, type), [items, query, type]);
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const routeId = params.id ? String(params.id) : null;

  const buildPath = (id: string, tab?: string) =>
    tab ? `/people/${group}/${id}/${tab}` : `/people/${group}/${id}`;

  useEffect(() => {
    if (routeId) {
      setLastSelectedId(routeId);
      return;
    }
    if (isPending || items.length === 0) return;
    const fallbackId =
      (lastSelectedId && itemIds.has(lastSelectedId) ? lastSelectedId : null) ?? items[0]?.id;
    if (!fallbackId) return;
    navigate(buildPath(fallbackId, activeTab), { replace: true });
  }, [
    activeTab,
    isPending,
    itemIds,
    items,
    lastSelectedId,
    navigate,
    routeId,
    setLastSelectedId,
  ]);

  useEffect(() => {
    if (!routeId || isPending || items.length === 0) return;
    if (itemIds.has(routeId)) return;
    const fallbackId =
      (lastSelectedId && itemIds.has(lastSelectedId) ? lastSelectedId : null) ?? items[0]?.id;
    if (!fallbackId) return;
    navigate(buildPath(fallbackId, activeTab), { replace: true });
  }, [activeTab, isPending, itemIds, items, lastSelectedId, navigate, routeId]);

  const selectedId = routeId && itemIds.has(routeId) ? routeId : null;

  const onSelect = (id: string) => {
    setLastSelectedId(id);
    navigate(buildPath(id, activeTab));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="xl:hidden">
        <div>
          <h1 className="text-2xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            Quick view and navigation for {titleByType[type].toLowerCase()}.
          </p>
        </div>
      </div>

      <PeopleDetailLayout
        type={type}
        onBack={() => navigate(`/people?type=${type}`)}
        items={filteredItems}
        selectedId={selectedId}
        onSelect={onSelect}
        query={query}
        onQueryChange={setQuery}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        isLoading={isPending}
      >
        {selectedId ? (
          <ShowBase resource="people" id={selectedId}>
            <PeopleProfileDetailsContent showBackButton={false} />
          </ShowBase>
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No {titleByType[type].toLowerCase()} found.
            </CardContent>
          </Card>
        )}
      </PeopleDetailLayout>
    </div>
  );
};
