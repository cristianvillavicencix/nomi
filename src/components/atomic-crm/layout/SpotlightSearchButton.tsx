import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useGetIdentity, useGetList, type RaRecord } from "ra-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";

import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { resolveEffectiveModules } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";
import { LBS_CONTACT_STATUSES_FOR_FILTER, LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import {
  isLeadLifecycleStatus,
} from "@/modules/constants/contactStatus";
import {
  getClientShowPath,
  getContactShowPath,
  getLeadShowPath,
} from "@/app/routing";

/**
 * Global Spotlight search. One button — searches across every module
 * the current user has access to (Leads, Clients, Contacts, Projects,
 * Projects) and renders results grouped by module. The module matching the
 * current URL is shown first so search "starts where you are".
 */
export type SpotlightSearchButtonProps = {
  /** Override placeholder copy. */
  placeholder?: string;
  /** Soft cap per-module (defaults to 5). */
  perModuleLimit?: number;
  /**
   * "hidden" mounts the component without a visible trigger button —
   * useful for routes (like Messages) that suppress the global top bar
   * but still need the ⌘K listener to work.
   */
  variant?: "default" | "hidden";
  /**
   * Legacy backward-compat props kept so existing call sites don't break.
   * They are ignored by the global behavior but accepted to avoid churn.
   */
  title?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  resource?: string;
  filter?: Record<string, unknown>;
  getHref?: (record: RaRecord) => string;
  renderItem?: (record: RaRecord, isActive: boolean) => ReactNode;
};

type ModuleId = "leads" | "clients" | "contacts" | "deals";

type ResolvedSuggestion = {
  moduleId: ModuleId;
  moduleLabel: string;
  record: RaRecord;
  href: string;
  renderRow: () => ReactNode;
};

const DEFAULT_LIMIT = 5;
const SEARCH_CONTACT_LIMIT = 15;

const leadFilter = () => ({
  "status@in": `(${LBS_LEAD_STATUSES_FOR_FILTER.map((s) => `"${s}"`).join(",")})`,
});

const contactFilter = () => ({
  "status@in": `(${LBS_CONTACT_STATUSES_FOR_FILTER.map((s) => `"${s}"`).join(",")})`,
});

const matchesPathByPrefix = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const fullName = (record: {
  first_name?: string | null;
  last_name?: string | null;
}) => `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim();

const truncatedJoin = (parts: Array<string | null | undefined>) =>
  parts.filter((p) => p && String(p).trim()).join(" · ") || "—";

const primaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((row) => row.email?.trim())?.email?.trim() ?? null;

const primaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((row) => row.number?.trim())?.number?.trim() ?? null;

export const SpotlightSearchButton = ({
  placeholder = "Search name, last name, phone, or email…",
  perModuleLimit = DEFAULT_LIMIT,
  variant = "default",
}: SpotlightSearchButtonProps = {}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { identity } = useGetIdentity();

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const modulePermissions = useMemo(
    () => resolveEffectiveModules(identity ?? null),
    [identity],
  );

  // Module access matrix — adapts to product mode (LBS vs contractor).
  const moduleAccess = useMemo(
    () => ({
      leads: modulePermissions.crm,
      clients: modulePermissions.crm,
      contacts: modulePermissions.crm,
      deals: modulePermissions.deal_operations,
    }),
    [modulePermissions],
  );

  // Detect the "home" module from the current URL.
  const currentModule: ModuleId | null = useMemo(() => {
    if (matchesPathByPrefix("/leads")(pathname)) return "leads";
    if (matchesPathByPrefix("/companies")(pathname)) return "clients";
    if (matchesPathByPrefix("/clients")(pathname)) return "clients";
    if (matchesPathByPrefix("/contacts")(pathname)) return "contacts";
    if (matchesPathByPrefix("/deals")(pathname)) return "deals";
    return null;
  }, [pathname]);

  // Per-module queries (called in stable order — hooks rule).
  const unifiedContactsQuery = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: SEARCH_CONTACT_LIMIT },
      sort: { field: "last_seen", order: "DESC" },
      filter: { q: trimmedQuery },
    },
    {
      enabled:
        open &&
        isSearching &&
        (moduleAccess.leads || moduleAccess.contacts),
      staleTime: 15_000,
    },
  );

  const leadsQuery = useGetList(
    "contacts",
    {
      pagination: { page: 1, perPage: perModuleLimit },
      sort: { field: "last_seen", order: "DESC" },
      filter: trimmedQuery
        ? { ...leadFilter(), q: trimmedQuery }
        : leadFilter(),
    },
    {
      enabled: open && !isSearching && moduleAccess.leads,
      staleTime: 15_000,
    },
  );

  const clientsQuery = useGetList(
    "companies",
    {
      pagination: { page: 1, perPage: perModuleLimit },
      sort: { field: "name", order: "ASC" },
      filter: trimmedQuery ? { q: trimmedQuery } : {},
    },
    { enabled: open && moduleAccess.clients, staleTime: 15_000 },
  );

  const contactsQuery = useGetList(
    "contacts",
    {
      pagination: { page: 1, perPage: perModuleLimit },
      sort: { field: "last_name", order: "ASC" },
      filter: trimmedQuery
        ? { ...contactFilter(), q: trimmedQuery }
        : contactFilter(),
    },
    {
      enabled: open && !isSearching && moduleAccess.contacts,
      staleTime: 15_000,
    },
  );

  const dealsQuery = useGetList(
    "deals",
    {
      pagination: { page: 1, perPage: perModuleLimit },
      sort: { field: "updated_at", order: "DESC" },
      filter: trimmedQuery ? { q: trimmedQuery } : {},
    },
    { enabled: open && moduleAccess.deals, staleTime: 15_000 },
  );

  // Build grouped suggestion list. Each group is the module's section.
  const groupedSuggestions: {
    id: ModuleId;
    label: string;
    rows: ResolvedSuggestion[];
  }[] = useMemo(() => {
    const buildLeadRow = (record: Contact): ResolvedSuggestion => ({
      moduleId: "leads",
      moduleLabel: "Leads",
      record,
      href: getLeadShowPath(record.id),
      renderRow: () => (
        <>
          <Avatar record={record} width={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {fullName(record) || record.company_name || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {truncatedJoin([
                record.company_name,
                primaryEmail(record),
                record.lead_stage,
                record.interested_service,
              ])}
            </p>
          </div>
        </>
      ),
    });

    const buildClientRow = (record: Company): ResolvedSuggestion => ({
      moduleId: "clients",
      moduleLabel: "Clientes",
      record,
      href: getClientShowPath(record.id),
      renderRow: () => (
        <>
          <CompanyAvatar record={record} width={28} height={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {record.name || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {truncatedJoin([record.sector, record.website])}
            </p>
          </div>
        </>
      ),
    });

    const buildContactRow = (record: Contact): ResolvedSuggestion => ({
      moduleId: "contacts",
      moduleLabel: "Contactos",
      record,
      href: getContactShowPath(record.id),
      renderRow: () => (
        <>
          <Avatar record={record} width={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {fullName(record) || record.company_name || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {truncatedJoin([
                record.company_name,
                primaryEmail(record),
                primaryPhone(record),
                record.title,
              ])}
            </p>
          </div>
        </>
      ),
    });

    const buildDealRow = (
      record: RaRecord & {
        name?: string;
        company_name?: string | null;
        stage?: string;
        category?: string | null;
      },
    ): ResolvedSuggestion => ({
      moduleId: "deals",
      moduleLabel: "Proyectos",
      record,
      href: `/deals/${record.id}/show`,
      renderRow: () => (
        <>
          <div className="grid size-7 place-items-center rounded-md bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
            {(record.name ?? "?").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {record.name || "Sin nombre"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {truncatedJoin([
                record.company_name,
                record.category,
                record.stage,
              ])}
            </p>
          </div>
        </>
      ),
    });

    const all: { id: ModuleId; label: string; rows: ResolvedSuggestion[] }[] =
      [];
    if (moduleAccess.leads) {
      const leadRows = isSearching
        ? (unifiedContactsQuery.data ?? [])
            .filter((record) => isLeadLifecycleStatus(record.status))
            .slice(0, perModuleLimit)
            .map(buildLeadRow)
        : (leadsQuery.data ?? []).map(buildLeadRow);
      if (leadRows.length > 0) {
        all.push({
          id: "leads",
          label: "Leads",
          rows: leadRows,
        });
      }
    }
    if (moduleAccess.clients) {
      const clientRows = (clientsQuery.data ?? []).map(buildClientRow);
      if (clientRows.length > 0) {
        all.push({
          id: "clients",
          label: "Clientes",
          rows: clientRows,
        });
      }
    }
    if (moduleAccess.contacts) {
      const contactRows = isSearching
        ? (unifiedContactsQuery.data ?? [])
            .filter((record) => !isLeadLifecycleStatus(record.status))
            .slice(0, perModuleLimit)
            .map(buildContactRow)
        : (contactsQuery.data ?? []).map(buildContactRow);
      if (contactRows.length > 0) {
        all.push({
          id: "contacts",
          label: "Contactos",
          rows: contactRows,
        });
      }
    }
    if (moduleAccess.deals) {
      all.push({
        id: "deals",
        label: "Proyectos",
        rows: (dealsQuery.data ?? []).map(buildDealRow),
      });
    }
    // Sort so the current module's section is rendered first.
    if (currentModule) {
      const idx = all.findIndex((g) => g.id === currentModule);
      if (idx > 0) {
        const [current] = all.splice(idx, 1);
        all.unshift(current);
      }
    }
    return all.filter((group) => group.rows.length > 0);
  }, [
    currentModule,
    isSearching,
    moduleAccess.clients,
    moduleAccess.contacts,
    moduleAccess.deals,
    moduleAccess.leads,
    clientsQuery.data,
    contactsQuery.data,
    dealsQuery.data,
    leadsQuery.data,
    perModuleLimit,
    unifiedContactsQuery.data,
  ]);

  // Flat list used for keyboard navigation.
  const flatSuggestions = useMemo(
    () => groupedSuggestions.flatMap((g) => g.rows),
    [groupedSuggestions],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  // Global Cmd+K / Ctrl+K toggle. Skip when typing in an input/textarea
  // so it doesn't hijack normal form interactions.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "k" && event.key !== "K") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const inEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      // Allow toggling even from an input — that's the whole point of
      // ⌘K. We just need to make sure we don't *also* type the letter.
      event.preventDefault();
      setOpen((prev) => !prev);
      void inEditable;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = useCallback(
    (s: ResolvedSuggestion) => {
      setOpen(false);
      navigate(s.href);
    },
    [navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + flatSuggestions.length) % flatSuggestions.length,
      );
    } else if (event.key === "Enter") {
      const target = flatSuggestions[activeIndex];
      if (target) {
        event.preventDefault();
        handleSelect(target);
      }
    }
  };

  const isFetching =
    (isSearching
      ? unifiedContactsQuery.isFetching
      : leadsQuery.isFetching || contactsQuery.isFetching) ||
    clientsQuery.isFetching ||
    dealsQuery.isFetching ||
    false;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {variant === "hidden" ? null : (
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Buscar"
            className={cn(
              "group flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3",
              "text-sm text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "sm:min-w-[220px] md:min-w-[260px]",
            )}
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden flex-1 truncate text-left sm:inline">
              Search name, last name, phone…
            </span>
            <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
              ⌘K
            </kbd>
          </button>
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/60 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-[50%] top-[12%] z-50 w-full max-w-[calc(100%-2rem)]",
            "translate-x-[-50%] rounded-2xl bg-background shadow-2xl ring-1 ring-border/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150 sm:max-w-2xl",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Buscar en NOMI
          </DialogPrimitive.Title>

          <div className="relative flex items-center px-4 py-3">
            <Search className="pointer-events-none size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="ml-3 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <kbd className="ml-2 hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          <div className="h-px bg-border/60" />

          <div className="max-h-[65vh] overflow-y-auto" role="listbox">
            {isFetching && flatSuggestions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Buscando…
              </p>
            ) : flatSuggestions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {trimmedQuery
                  ? "Sin coincidencias en los módulos a los que tienes acceso."
                  : "Empieza a escribir para buscar en NOMI."}
              </p>
            ) : (
              groupedSuggestions.map((group, groupIndex) => {
                const baseIndex = groupedSuggestions
                  .slice(0, groupIndex)
                  .reduce((acc, g) => acc + g.rows.length, 0);
                return (
                  <div key={group.id} className="py-1">
                    <div className="sticky top-0 z-10 bg-background/95 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                      {group.label}
                      {group.id === currentModule ? (
                        <span className="ml-2 rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                          aquí
                        </span>
                      ) : null}
                    </div>
                    <div className="px-2 pb-1">
                      {group.rows.map((row, rowIndex) => {
                        const flatIndex = baseIndex + rowIndex;
                        const isActive = flatIndex === activeIndex;
                        return (
                          <button
                            type="button"
                            key={`${row.moduleId}-${row.record.id}`}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => handleSelect(row)}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-muted",
                            )}
                          >
                            {row.renderRow()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
