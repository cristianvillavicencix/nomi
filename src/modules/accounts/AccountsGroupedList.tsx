import { useEffect, useMemo, useState } from "react";
import {
  useGetIdentity,
  useListContext,
  useListFilterContext,
  type Identifier,
} from "ra-core";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  Plus,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageActions } from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Contact } from "@/components/atomic-crm/types";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { NewClientDialog } from "@/modules/clients/NewClientDialog";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";
import { ClientAddContactDialog } from "@/modules/clients/ClientAddContactDialog";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import {
  getLeadStageDef,
  normalizeLeadStage,
} from "@/modules/leads/leadStages";
import {
  isLeadLifecycleStatus,
  LBS_CLIENT_STATUS,
  LBS_CONTACT_STATUSES_FOR_FILTER,
} from "@/modules/constants/contactStatus";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { mailtoHref } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import {
  orderContactsForCompany,
  useCompanyNestedContacts,
} from "@/modules/accounts/useCompanyNestedContacts";

const NESTED_VISIBLE_CAP = 5;

type AccountsListFilter = "all" | "pipeline" | "clients";

const FILTER_CHIPS: { id: AccountsListFilter; label: string }[] = [
  { id: "all", label: "All accounts" },
  { id: "pipeline", label: "Pipeline" },
  { id: "clients", label: "Clients" },
];

/** Company-first Accounts list with nested representatives. */
export const AccountsGroupedList = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [addContactCompanyId, setAddContactCompanyId] =
    useState<Identifier | null>(null);

  const canCreateCompany = canAccess(identity as AccessIdentity, {
    resource: "companies",
    action: "create",
  });
  const canCreateContact = canAccess(identity as AccessIdentity, {
    resource: "contacts",
    action: "create",
  });

  useEffect(() => {
    const create = searchParams.get("create");
    if (create === "company") {
      setCompanyDialogOpen(true);
    } else if (create === "contact") {
      setContactDialogOpen(true);
    } else if (create === "lead") {
      setLeadDialogOpen(true);
    } else {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      <List
        resource="companies"
        title={false}
        disableBreadcrumb
        perPage={25}
        sort={{ field: "name", order: "ASC" }}
        actions={
          <PageActions>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canCreateContact ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLeadDialogOpen(true)}
                >
                  <UserPlus className="size-4" />
                  New lead
                </Button>
              ) : null}
              {canCreateCompany ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompanyDialogOpen(true)}
                >
                  <Plus className="size-4" />
                  New company
                </Button>
              ) : null}
              <ModuleInfoPopover
                title="Accounts"
                description="Bill-to companies with nested people. Use Board for the leads pipeline. Invoices and tickets stay linked to the company."
              />
            </div>
          </PageActions>
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <AccountsGroupedListBody
          canViewContacts={canAccess(identity as AccessIdentity, {
            resource: "contacts",
            action: "list",
          })}
          onAddContact={(companyId) => setAddContactCompanyId(companyId)}
          onNewCompany={() => setCompanyDialogOpen(true)}
          onNewLead={() => setLeadDialogOpen(true)}
          canCreateCompany={canCreateCompany}
          canCreateContact={canCreateContact}
        />
      </List>
      <NewClientDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
      />
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
      {addContactCompanyId != null ? (
        <ClientAddContactDialog
          companyId={addContactCompanyId}
          open
          onOpenChange={(open) => {
            if (!open) setAddContactCompanyId(null);
          }}
        />
      ) : null}
      <NewLeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
    </div>
  );
};

const AccountsGroupedListBody = ({
  canViewContacts,
  onAddContact,
  onNewCompany,
  onNewLead,
  canCreateCompany,
  canCreateContact,
}: {
  canViewContacts: boolean;
  onAddContact: (companyId: Identifier) => void;
  onNewCompany: () => void;
  onNewLead: () => void;
  canCreateCompany: boolean;
  canCreateContact: boolean;
}) => {
  const { data, isPending, total } =
    useListContext<CompanyWithPrimaryContact>();
  const { filterValues, setFilters, displayedFilters } =
    useListFilterContext();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAllByCompany, setShowAllByCompany] = useState<Set<string>>(
    new Set(),
  );
  const [scopeFilter, setScopeFilter] = useState<AccountsListFilter>("all");
  const [searchDraft, setSearchDraft] = useState(
    typeof filterValues?.q === "string" ? filterValues.q : "",
  );

  const companyIds = useMemo(
    () => (data ?? []).map((company) => company.id),
    [data],
  );

  const {
    contactsByCompanyId,
    orphanLeads,
    orphansTruncated,
    isPending: nestedPending,
  } = useCompanyNestedContacts(companyIds, {
    enabled: !isPending && canViewContacts,
    fetchOrphans: canViewContacts,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = { ...(filterValues ?? {}) };
      const trimmed = searchDraft.trim();
      if (trimmed) next.q = trimmed;
      else delete next.q;
      const currentQ =
        typeof filterValues?.q === "string" ? filterValues.q : "";
      if (trimmed === currentQ.trim()) return;
      setFilters(next, displayedFilters);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce search only

  const clearFilters = () => {
    setScopeFilter("all");
    setSearchDraft("");
    setFilters({}, {});
  };

  const toggleExpanded = (companyId: Identifier) => {
    const key = String(companyId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleCompanies = useMemo(() => {
    if (!data?.length) return [];
    if (scopeFilter === "all" || !canViewContacts) return data;

    return data.filter((company) => {
      const contacts = contactsByCompanyId.get(String(company.id)) ?? [];
      if (scopeFilter === "pipeline") {
        return contacts.some((c) => isLeadLifecycleStatus(c.status));
      }
      return (
        contacts.some((c) =>
          (LBS_CONTACT_STATUSES_FOR_FILTER as readonly string[]).includes(
            c.status ?? "",
          ),
        ) || company.primary_contact_status === LBS_CLIENT_STATUS
      );
    });
  }, [canViewContacts, contactsByCompanyId, data, scopeFilter]);

  const showOrphans =
    canViewContacts &&
    (scopeFilter === "all" || scopeFilter === "pipeline") &&
    orphanLeads.length > 0;

  if (isPending) return null;

  const hasNoCompanies = !data?.length;
  const filterYieldsEmpty =
    !hasNoCompanies && visibleCompanies.length === 0 && !showOrphans;

  if (hasNoCompanies && !searchDraft.trim()) {
    return (
      <AccountsEmptyState
        onNewCompany={canCreateCompany ? onNewCompany : undefined}
        onNewLead={canCreateContact ? onNewLead : undefined}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTER_CHIPS.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              size="sm"
              variant={scopeFilter === chip.id ? "default" : "outline"}
              onClick={() => setScopeFilter(chip.id)}
              disabled={chip.id !== "all" && !canViewContacts}
            >
              {chip.label}
            </Button>
          ))}
        </div>
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search companies…"
          className="w-full sm:max-w-xs"
          aria-label="Search companies"
        />
      </div>

      {filterYieldsEmpty ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No accounts match these filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {showOrphans ? (
            <OrphanLeadsSection
              leads={orphanLeads}
              truncated={orphansTruncated}
            />
          ) : null}
          {visibleCompanies.map((company) => {
            const key = String(company.id);
            const contacts = orderContactsForCompany(
              contactsByCompanyId.get(key) ?? [],
              company.primary_contact_id,
            );
            const expanded = expandedIds.has(key) || contacts.length <= 3;
            const showAll = showAllByCompany.has(key);
            const visibleContacts = showAll
              ? contacts
              : contacts.slice(0, NESTED_VISIBLE_CAP);
            const hiddenCount = contacts.length - visibleContacts.length;

            return (
              <li key={key} className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="mt-1 text-muted-foreground hover:text-foreground"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse people" : "Expand people"}
                    onClick={() => toggleExpanded(company.id)}
                  >
                    {expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <CompanyAvatar record={company} width={32} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={getClientShowPath(company.id)}
                        className="truncate font-medium link-action"
                      >
                        {company.name?.trim() || "Untitled company"}
                      </Link>
                      {canViewContacts && contacts.length > 0 ? (
                        <Badge variant="secondary" className="font-normal">
                          {contacts.length}{" "}
                          {contacts.length === 1 ? "person" : "people"}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <CrmPhoneLink
                        phone={resolveCompanyPhoneRaw(company)}
                        contactId={company.primary_contact_id}
                        className="link-action"
                      />
                      {(() => {
                        const email = resolveCompanyEmailForDisplay(company);
                        const href = mailtoHref(email);
                        if (!href || email === "—") {
                          return <span>{email}</span>;
                        }
                        return (
                          <a href={href} className="link-action">
                            {email}
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {expanded && canViewContacts ? (
                  <div className="mt-3 ml-10 space-y-1 border-l pl-3">
                    {nestedPending && contacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Loading people…
                      </p>
                    ) : null}
                    {!nestedPending && contacts.length === 0 ? (
                      <div className="flex flex-wrap items-center gap-2 py-1">
                        <span className="text-xs text-muted-foreground">
                          No people yet
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onAddContact(company.id)}
                        >
                          <Plus className="size-3.5" />
                          Add contact
                        </Button>
                      </div>
                    ) : null}
                    {visibleContacts.map((contact) => (
                      <NestedContactRow
                        key={String(contact.id)}
                        contact={contact}
                        isPrimary={
                          company.primary_contact_id != null &&
                          String(company.primary_contact_id) ===
                            String(contact.id)
                        }
                      />
                    ))}
                    {hiddenCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setShowAllByCompany((prev) => {
                            const next = new Set(prev);
                            next.add(key);
                            return next;
                          })
                        }
                      >
                        Show {hiddenCount} more
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {total != null && total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? "company" : "companies"}
        </p>
      ) : null}
    </div>
  );
};

const NestedContactRow = ({
  contact,
  isPrimary,
}: {
  contact: Contact;
  isPrimary: boolean;
}) => {
  const isLead = isLeadLifecycleStatus(contact.status);
  const stage = isLead
    ? getLeadStageDef(normalizeLeadStage(contact.lead_stage))
    : null;

  return (
    <Link
      to={getPersonShowPath(contact)}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
    >
      <Avatar record={contact} width={22} />
      <span className="min-w-0 flex-1 truncate">
        {getContactFullName(contact)}
      </span>
      {isPrimary ? (
        <Badge variant="outline" className="shrink-0 font-normal">
          Primary
        </Badge>
      ) : null}
      {isLead && stage ? (
        <span
          className="shrink-0 text-xs font-medium"
          style={{ color: stage.color }}
        >
          {stage.label}
        </span>
      ) : (
        <Badge variant="secondary" className="shrink-0 font-normal capitalize">
          {contact.status?.replace("_", " ") || "contact"}
        </Badge>
      )}
    </Link>
  );
};

const OrphanLeadsSection = ({
  leads,
  truncated,
}: {
  leads: Contact[];
  truncated: boolean;
}) => (
  <li className="bg-muted/20 p-3 sm:p-4">
    <div className="mb-2 flex items-center gap-2">
      <UserCheck className="size-4 text-muted-foreground" />
      <h3 className="text-sm font-medium">No company</h3>
      <Badge variant="secondary" className="font-normal">
        {leads.length}
        {truncated ? "+" : ""}
      </Badge>
    </div>
    <p className="mb-2 text-xs text-muted-foreground">
      Leads without a company. Link a company when you convert or edit the lead.
    </p>
    <ul className="space-y-1 border-l pl-3">
      {leads.map((lead) => (
        <NestedContactRow
          key={String(lead.id)}
          contact={lead}
          isPrimary={false}
        />
      ))}
    </ul>
    {truncated ? (
      <p className="mt-2 text-xs text-muted-foreground">
        Showing the most recent orphan leads. Open Board to see the full
        pipeline.
      </p>
    ) : null}
  </li>
);

const AccountsEmptyState = ({
  onNewCompany,
  onNewLead,
}: {
  onNewCompany?: () => void;
  onNewLead?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
    <Building2 className="size-10 text-muted-foreground" />
    <div className="space-y-1">
      <h3 className="text-lg font-semibold">No accounts yet</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add a bill-to company or create a lead to start the know → close → bill
        journey.
      </p>
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      {onNewCompany ? (
        <Button type="button" variant="outline" size="sm" onClick={onNewCompany}>
          <Plus className="size-4" />
          New company
        </Button>
      ) : null}
      {onNewLead ? (
        <Button type="button" variant="outline" size="sm" onClick={onNewLead}>
          <KanbanSquare className="size-4" />
          New lead
        </Button>
      ) : null}
    </div>
  </div>
);
