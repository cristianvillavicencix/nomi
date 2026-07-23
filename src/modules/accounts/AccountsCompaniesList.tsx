import { useEffect, useState } from "react";
import {
  useGetIdentity,
  useListContext,
  useListFilterContext,
  type Identifier,
} from "ra-core";
import { Building2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
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
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { Company } from "@/components/atomic-crm/types";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { OpenMailComposeLink } from "@/modules/mail/OpenMailComposeLink";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { useIsMobile } from "@/hooks/use-mobile";
import { getClientShowPath } from "@/app/routing";
import { buildAccountsCompanyPreviewParams } from "@/modules/accounts/AccountsCompanyPreviewSheet";
import { buildAccountsPersonPreviewParams } from "@/modules/accounts/AccountsLeadPreviewSheet";
import {
  AccountsModuleToolbar,
  type AccountsHubChrome,
} from "@/modules/accounts/AccountsModuleToolbar";
import { ModuleSearchField } from "@/components/atomic-crm/layout/ModuleToolbar";
import { cn } from "@/lib/utils";

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

/** Company-first Accounts List — bill-to directory with primary contact context. */
export const AccountsCompaniesList = ({
  accountsChrome,
}: {
  accountsChrome: AccountsHubChrome;
}) => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      <List
        resource="companies"
        title={false}
        disableBreadcrumb
        perPage={25}
        sort={{ field: "name", order: "ASC" }}
        actions={false}
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <AccountsCompaniesListBody accountsChrome={accountsChrome} />
      </List>
    </div>
  );
};

const AccountsCompaniesListBody = ({
  accountsChrome,
}: {
  accountsChrome: AccountsHubChrome;
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], total, isPending } = useListContext<Company>();
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

  const openCompany = (companyId: Identifier) => {
    if (isMobile) {
      navigate(getClientShowPath(companyId));
      return;
    }
    setSearchParams(buildAccountsCompanyPreviewParams(searchParams, companyId), {
      replace: true,
    });
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

  const toolbar = (
    <AccountsModuleToolbar
      {...accountsChrome}
      leadingExtra={
        <ModuleSearchField
          value={searchDraft}
          onChange={setSearchDraft}
          basePlaceholder="Search business name, email, phone, or website"
          total={total}
          itemSingular="company"
          itemPlural="companies"
        />
      }
    />
  );

  if (isPending) return null;

  if (!data.length && !String(filterValues?.q ?? "").trim()) {
    return (
      <div className="space-y-3">
        {toolbar}
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
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}

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
                const phone = resolveCompanyPhoneRaw(company);
                const website = String(company.website ?? "").trim();
                const websiteHref = normalizeWebsiteHref(website);
                const contactName = primaryContactName(company);
                const status = statusLabel(company);

                return (
                  <TableRow
                    key={String(company.id)}
                    className="cursor-pointer [&_td]:py-1.5 [&_td]:leading-normal"
                    onClick={() => openCompany(company.id)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyAvatar record={company} width={32} />
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
                      {email && email !== "—" ? (
                        <OpenMailComposeLink
                          to={email}
                          companyId={company.id}
                          contactId={company.primary_contact_id ?? undefined}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                        >
                          {email}
                        </OpenMailComposeLink>
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
                            "text-[10px] font-medium",
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
