import { useEffect, useMemo, useState } from "react";
import {
  useGetIdentity,
  useGetMany,
  useListContext,
  useListFilterContext,
  type Identifier,
} from "ra-core";
import { Building2, Plus, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import {
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw} from "@/modules/clients/clientShowUtils";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import {
  getLeadStageDef,
  normalizeLeadStage} from "@/modules/leads/leadStages";
import {
  isLeadLifecycleStatus,
  LBS_CONTACT_STATUSES_FOR_FILTER,
  LBS_LEAD_STATUSES_FOR_FILTER} from "@/modules/constants/contactStatus";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { mailtoHref } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildAccountsPersonPreviewParams } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { buildAccountsCompanyPreviewParams } from "@/modules/accounts/AccountsCompanyPreviewSheet";
import { cn } from "@/lib/utils";

const PEOPLE_STATUS_FILTER = {
  "status@in": `(${[
    ...LBS_LEAD_STATUSES_FOR_FILTER,
    ...LBS_CONTACT_STATUSES_FOR_FILTER,
  ]
    .map((s) => `"${s}"`)
    .join(",")})`};

const NO_COMPANY_FILTER_KEY = "company_id@is";

/** People with a company first (by name), then people without a company. */
const sortPeopleForAccountsList = (people: Contact[]) =>
  [...people].sort((a, b) => {
    const aHasCompany = a.company_id != null ? 0 : 1;
    const bHasCompany = b.company_id != null ? 0 : 1;
    if (aHasCompany !== bHasCompany) return aHasCompany - bHasCompany;
    return getContactFullName(a).localeCompare(getContactFullName(b), undefined, {
      sensitivity: "base"});
  });

/** Flat people directory (leads + contacts) — Accounts List. */
export const AccountsPeopleList = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  const canCreateContact = canAccess(identity as AccessIdentity, {
    resource: "contacts",
    action: "create"});

  useEffect(() => {
    const create = searchParams.get("create");
    if (create === "contact") {
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
        resource="contacts"
        title={false}
        disableBreadcrumb
        perPage={25}
        sort={{ field: "last_name", order: "ASC" }}
        filter={PEOPLE_STATUS_FILTER}
        actions={false}
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <AccountsPeopleListBody
          canCreate={canCreateContact}
          onNewLead={() => setLeadDialogOpen(true)}
          onNewContact={() => setContactDialogOpen(true)}
        />
      </List>
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
      <NewLeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
    </div>
  );
};

const AccountsPeopleListBody = ({
  canCreate,
  onNewLead,
  onNewContact}: {
  canCreate: boolean;
  onNewLead: () => void;
  onNewContact: () => void;
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, total } = useListContext<Contact>();
  const { filterValues, setFilters, displayedFilters } =
    useListFilterContext();

  const noCompanyActive = filterValues?.[NO_COMPANY_FILTER_KEY] === null;

  const [searchDraft, setSearchDraft] = useState(
    typeof filterValues?.q === "string" ? filterValues.q : "",
  );

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

  const toggleNoCompany = () => {
    const next = { ...(filterValues ?? {}) };
    if (noCompanyActive) {
      delete next[NO_COMPANY_FILTER_KEY];
    } else {
      next[NO_COMPANY_FILTER_KEY] = null;
    }
    setFilters(next, displayedFilters);
  };

  const openPerson = (contact: Contact) => {
    if (isMobile) {
      navigate(getPersonShowPath(contact));
      return;
    }
    setSearchParams(buildAccountsPersonPreviewParams(searchParams, contact), {
      replace: true});
  };

  const openCompany = (companyId: string | number) => {
    if (isMobile) {
      navigate(getClientShowPath(companyId));
      return;
    }
    setSearchParams(
      buildAccountsCompanyPreviewParams(searchParams, companyId),
      { replace: true },
    );
  };

  const people = useMemo(
    () => sortPeopleForAccountsList(data ?? []),
    [data],
  );

  const companyIds = useMemo(() => {
    const ids = new Set<Identifier>();
    for (const person of people) {
      if (person.company_id != null) ids.add(person.company_id);
    }
    return Array.from(ids);
  }, [people]);

  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companyById = useMemo(() => {
    const map = new Map<Identifier, Company>();
    for (const company of companies ?? []) {
      if (company?.id != null) map.set(company.id, company);
    }
    return map;
  }, [companies]);

  if (isPending) return null;

  const hasSearch = Boolean(searchDraft.trim());
  const hasNoCompanyFilter = noCompanyActive;

  if (!people.length && !hasSearch && !hasNoCompanyFilter) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Users className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">No people yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a lead or contact to start working your pipeline and directory.
          </p>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onNewLead}>
              <Plus className="size-4" />
              New lead
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNewContact}
            >
              <Plus className="size-4" />
              New contact
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="sm"
            variant={noCompanyActive ? "primary" : "secondary"}
            onClick={toggleNoCompany}
          >
            No company
          </Button>
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search people…"
            className="w-full sm:max-w-xs"
            aria-label="Search people"
          />
        </div>
        {canCreate ? (
          <ModuleToolbarActions>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNewLead}
              aria-label="New lead"
            >
              <Plus className="size-4" />
              New lead
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNewContact}
              aria-label="New contact"
            >
              <Plus className="size-4" />
              New contact
            </Button>
          </ModuleToolbarActions>
        ) : null}
      </ModuleToolbar>

      {!people.length ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {noCompanyActive
              ? "No people without a company match."
              : "No people match this search."}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchDraft("");
              const next = { ...(filterValues ?? {}) };
              delete next.q;
              delete next[NO_COMPANY_FILTER_KEY];
              setFilters(next, displayedFilters);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[200px]">Name</TableHead>
                <TableHead className="min-w-[140px]">Company</TableHead>
                <TableHead className="min-w-[120px]">Phone</TableHead>
                <TableHead className="min-w-[160px]">Email</TableHead>
                <TableHead className="min-w-[120px]">Status / Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((contact) => (
                <PersonRow
                  key={String(contact.id)}
                  contact={contact}
                  isClient={
                    contact.company_id != null
                      ? companyById.get(contact.company_id)?.is_client === true
                      : false
                  }
                  onOpenPerson={() => openPerson(contact)}
                  onOpenCompany={openCompany}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total != null && total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? "person" : "people"}
        </p>
      ) : null}
    </div>
  );
};

const PersonRow = ({
  contact,
  isClient,
  onOpenPerson,
  onOpenCompany}: {
  contact: Contact;
  isClient: boolean;
  onOpenPerson: () => void;
  onOpenCompany: (companyId: string | number) => void;
}) => {
  const isLead = isLeadLifecycleStatus(contact.status);
  const stage = isLead
    ? getLeadStageDef(normalizeLeadStage(contact.lead_stage))
    : null;
  const email = getContactEmail(contact);
  const emailHref = mailtoHref(email);
  const phone = getContactPhoneRaw(contact);
  const companyName = contact.company_name?.trim();
  const companyId = contact.company_id;

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpenPerson}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenPerson();
        }
      }}
      tabIndex={0}
    >
      <TableCell>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar record={contact} width={28} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate font-medium">
                {getContactFullName(contact)}
              </span>
              {contact.is_primary_contact ? (
                <Badge variant="outline" className="font-normal">
                  Primary
                </Badge>
              ) : null}
            </div>
            {contact.title?.trim() ? (
              <p className="truncate text-xs text-muted-foreground">
                {contact.title.trim()}
              </p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell
        className="text-sm"
        onClick={(event) => event.stopPropagation()}
      >
        {companyId != null && companyName ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 text-left link-action",
              )}
              onClick={() => onOpenCompany(companyId)}
            >
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{companyName}</span>
            </button>
            {isClient ? (
              <Badge variant="outline" className="font-normal">
                Client
              </Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell
        className="text-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <CrmPhoneLink
          phone={phone}
          contactId={contact.id}
          className="link-action"
        />
      </TableCell>
      <TableCell
        className="text-sm"
        onClick={(event) => event.stopPropagation()}
      >
        {emailHref && email ? (
          <a href={emailHref} className="link-action">
            {email}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {isLead && stage ? (
          <span
            className="text-xs font-medium"
            style={{ color: stage.color }}
          >
            {stage.label}
          </span>
        ) : (
          <Badge variant="secondary" className="font-normal capitalize">
            {contact.status?.replace("_", " ") || "contact"}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
};
