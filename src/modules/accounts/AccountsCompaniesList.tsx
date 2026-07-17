import { useEffect, useState } from "react";
import {
  useGetIdentity,
  useListContext,
  useListFilterContext,
  type Identifier,
} from "ra-core";
import { Building2, Plus, Search, UserPlus } from "lucide-react";
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
  TableRow,
} from "@/components/ui/table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageActions } from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { Company } from "@/components/atomic-crm/types";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { NewClientDialog } from "@/modules/clients/NewClientDialog";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import { mailtoHref } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { getClientShowPath } from "@/app/routing";
import { buildAccountsCompanyPreviewParams } from "@/modules/accounts/AccountsCompanyPreviewSheet";
import { buildAccountsPersonPreviewParams } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { cn } from "@/lib/utils";
import { extractDomainFromUrl } from "@/lib/faviconSources";

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const primaryContactName = (company: Company) => {
  const name = [
    company.primary_contact_first_name,
    company.primary_contact_last_name,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
};

const statusLabel = (company: Company) => {
  if (company.is_client) return "Client";
  const raw = String(company.primary_contact_status ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "lead" || raw === "prospect") {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  if (raw === "client") return "Client";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const statusBadgeClass = (company: Company, status: string) => {
  if (company.is_client || status === "Client") {
    return "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100";
  }
  if (status === "Lead") {
    return "border-violet-300/70 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100";
  }
  if (status === "Prospect") {
    return "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100";
  }
  return "text-muted-foreground";
};

const companySubtitle = (company: Company) => {
  const domain = extractDomainFromUrl(company.website);
  if (domain) return domain;
  const n = Number(company.nb_contacts ?? 0);
  if (n > 0) return `${n} contact${n === 1 ? "" : "s"}`;
  return null;
};

/** Company-first Accounts List — bill-to directory with primary contact context. */
export const AccountsCompaniesList = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "company") {
      setCompanyDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!identity) return null;

  const canCreateCompany = canAccess(identity as AccessIdentity, {
    resource: "companies",
    action: "create",
  });
  const canCreateContact = canAccess(identity as AccessIdentity, {
    resource: "contacts",
    action: "create",
  });

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
              {canCreateCompany ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompanyDialogOpen(true)}
                >
                  <Building2 className="size-4" />
                  New company
                </Button>
              ) : null}
              {canCreateContact ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeadDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    New lead
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactDialogOpen(true)}
                  >
                    <UserPlus className="size-4" />
                    New contact
                  </Button>
                </>
              ) : null}
              <ModuleInfoPopover
                title="Accounts"
                description="Companies (bill-to) with primary contact, phone, email, and website. Click a row to open the company preview; click the primary contact for their profile preview."
              />
            </div>
          </PageActions>
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <AccountsCompaniesListBody />
      </List>

      <NewClientDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
      />
      <NewLeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  );
};

const AccountsCompaniesListBody = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isPending, total } = useListContext<Company>();
  const { filterValues, setFilters } = useListFilterContext();
  const [searchDraft, setSearchDraft] = useState(
    String(filterValues?.q ?? ""),
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

  const openCompany = (companyId: Identifier) => {
    if (isMobile) {
      navigate(getClientShowPath(companyId));
      return;
    }
    setSearchParams(
      buildAccountsCompanyPreviewParams(searchParams, companyId),
      { replace: true },
    );
  };

  const openPerson = (
    contact: Pick<Company, "primary_contact_id" | "primary_contact_status">,
  ) => {
    if (!contact.primary_contact_id) return;
    setSearchParams(
      buildAccountsPersonPreviewParams(searchParams, {
        id: contact.primary_contact_id,
        status: contact.primary_contact_status,
        lead_stage: null,
      }),
      { replace: true },
    );
  };

  if (isPending) return null;

  if (!data.length && !String(filterValues?.q ?? "").trim()) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Building2 className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">No companies yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a company to start your Accounts directory. People stay linked
            under each company preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search business name, email, phone, or website…"
            className="pl-9"
          />
        </div>
        {typeof total === "number" ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {total} compan{total === 1 ? "y" : "ies"}
          </p>
        ) : null}
      </div>

      {!data.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No companies match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">
                  Business name
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Primary contact
                </TableHead>
                <TableHead className="text-muted-foreground">Phone</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Website</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((company) => {
                const email = resolveCompanyEmailForDisplay(company);
                const emailHref = mailtoHref(email);
                const phone = resolveCompanyPhoneRaw(company);
                const website = String(company.website ?? "").trim();
                const websiteHref = normalizeWebsiteHref(website);
                const contactName = primaryContactName(company);
                const status = statusLabel(company);
                const subtitle = companySubtitle(company);

                return (
                  <TableRow
                    key={String(company.id)}
                    className="cursor-pointer [&_td]:py-2.5 [&_td]:leading-normal"
                    onClick={() => openCompany(company.id)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyAvatar record={company} width={40} />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-foreground">
                              {company.name?.trim() || "Untitled company"}
                            </span>
                            {company.is_client ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-emerald-300/70 bg-emerald-50 px-1.5 py-0 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                              >
                                Client
                              </Badge>
                            ) : null}
                          </div>
                          {subtitle ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {subtitle}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contactName && company.primary_contact_id ? (
                        <button
                          type="button"
                          className="text-left font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPerson(company);
                          }}
                        >
                          {contactName}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <CrmPhoneLink
                        phone={phone}
                        contactId={company.primary_contact_id}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                      />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {emailHref && email !== "—" ? (
                        <a
                          href={emailHref}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                        >
                          {email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {website && websiteHref ? (
                        <a
                          href={websiteHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                        >
                          {website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium",
                            statusBadgeClass(company, status),
                          )}
                        >
                          {status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
