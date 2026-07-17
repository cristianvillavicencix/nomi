import { useMemo, useState } from "react";
import { useGetIdentity, useGetList, useGetOne } from "ra-core";
import {
  ArrowRight,
  Building2,
  Globe,
  Mail,
  PanelRightClose,
  Phone,
  Plus,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  getClientDealCreatePath,
  getClientShowPath,
  getPersonShowPath,
} from "@/app/routing";
import { ActivityLog } from "@/components/atomic-crm/activity/ActivityLog";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { mailtoHref } from "@/lib/linking";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { buildOpenDealsFilter } from "@/modules/deals/openDealFilters";
import {
  getLeadStageDef,
  normalizeLeadStage,
} from "@/modules/leads/leadStages";
import { buildAccountsPersonPreviewParams } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import {
  EntityMetaItem,
  formatCompanyLocation,
} from "@/modules/shared/profile";

const PREVIEW_TABS = ["activity", "deals", "tickets", "contacts"] as const;
type PreviewTab = (typeof PREVIEW_TABS)[number];

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

/** Compact company drawer: activity / deals / tickets / contacts. */
export const AccountsCompanyOverviewPreview = ({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<PreviewTab>("activity");
  const { data: identity } = useGetIdentity();
  const { dealStages, dealPipelineStatuses, companySectors } =
    useConfigurationContext();
  const canCreateDeal = canAccess(identity, {
    resource: "deals",
    action: "create",
  });

  const { data: company, isPending } = useGetOne<Company>("companies", {
    id: companyId,
  });

  const { data: contacts = [], isPending: contactsPending } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
      filter: { "company_id@eq": companyId },
    },
    { enabled: Boolean(companyId) },
  );

  const openDealsFilter = useMemo(
    () =>
      buildOpenDealsFilter(dealPipelineStatuses, dealStages, {
        "company_id@eq": companyId,
      }),
    [companyId, dealPipelineStatuses, dealStages],
  );

  const { data: openDeals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: openDealsFilter,
      pagination: { page: 1, perPage: 20 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: Boolean(companyId), staleTime: 30_000 },
  );

  const { data: tickets = [], isPending: ticketsPending } = useGetList<Ticket>(
    "tickets",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: Boolean(companyId), staleTime: 30_000 },
  );

  const openPerson = (contact: Contact) => {
    if (isMobile) {
      navigate(getPersonShowPath(contact));
      return;
    }
    const next = buildAccountsPersonPreviewParams(searchParams, contact);
    next.delete("company");
    setSearchParams(next, { replace: true });
  };

  if (isPending || !company) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <PreviewChrome
          title="Company Preview"
          onClose={onClose}
          fullViewPath={getClientShowPath(companyId)}
          newDealPath={
            canCreateDeal ? getClientDealCreatePath(companyId) : undefined
          }
        />
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const website = String(company.website ?? "").trim();
  const websiteHref = normalizeWebsiteHref(website);
  const phone = resolveCompanyPhoneRaw(company);
  const email = resolveCompanyEmailForDisplay(company);
  const emailHref = mailtoHref(email);
  const address = formatCompanyLocation(company);
  const sectorLabel = company.sector
    ? (companySectors.find((s) => s.value === company.sector)?.label ??
      company.sector)
    : null;
  const fullViewPath = getClientShowPath(company.id);
  const newDealPath = canCreateDeal
    ? getClientDealCreatePath(company.id)
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <PreviewChrome
        title="Company Preview"
        onClose={onClose}
        fullViewPath={fullViewPath}
        newDealPath={newDealPath}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Identity header */}
        <div className="border-b border-border/60 bg-gradient-to-br from-sky-50/60 via-background to-background px-4 py-4 dark:from-sky-950/25">
          <div className="flex items-start gap-3">
            <CompanyAvatar record={company} width={52} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 className="truncate text-lg font-semibold tracking-tight">
                  {company.name?.trim() || "Untitled company"}
                </h2>
                {company.is_client === true ? (
                  <Badge variant="default" className="font-normal">
                    Client
                  </Badge>
                ) : null}
              </div>
              {website && websiteHref ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 text-sm link-action"
                >
                  <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{website}</span>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No website</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <EntityMetaItem label="Phone">
              <CrmPhoneLink phone={phone} className="link-action" />
            </EntityMetaItem>
            <EntityMetaItem label="Email">
              {emailHref && email !== "—" ? (
                <a href={emailHref} className="link-action truncate">
                  {email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </EntityMetaItem>
            {address && address !== "—" ? (
              <EntityMetaItem label="Location">
                <span className="line-clamp-2 font-normal text-muted-foreground">
                  {address}
                </span>
              </EntityMetaItem>
            ) : null}
            {sectorLabel ? (
              <EntityMetaItem label="Sector">{sectorLabel}</EntityMetaItem>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {phone ? (
              <CrmPhoneLink
                phone={phone}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <Phone className="size-3.5" />
                Call
              </CrmPhoneLink>
            ) : null}
            {emailHref && email !== "—" ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                <a href={emailHref}>
                  <Mail className="size-3.5" />
                  Email
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="p-4 pt-3">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as PreviewTab)}
          >
            <TabsList className="mb-3 h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
              <PreviewTabTrigger value="activity" label="Activity" />
              <PreviewTabTrigger
                value="deals"
                label="Deals"
                count={openDeals.length}
              />
              <PreviewTabTrigger
                value="tickets"
                label="Tickets"
                count={tickets.length}
              />
              <PreviewTabTrigger
                value="contacts"
                label="Contacts"
                count={contacts.length}
              />
            </TabsList>

            <TabsContent value="activity" className="mt-0">
              <ActivityLog
                companyId={company.id}
                context="company"
                pageSize={8}
              />
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto px-0 link-action"
                asChild
              >
                <Link to={fullViewPath}>View full activity</Link>
              </Button>
            </TabsContent>

            <TabsContent value="deals" className="mt-0 space-y-3">
              {dealsPending ? (
                <p className="text-sm text-muted-foreground">Loading deals…</p>
              ) : openDeals.length === 0 ? (
                <EmptyBlock
                  message="No open deals for this company yet."
                  action={
                    newDealPath ? (
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <Link to={newDealPath}>
                          <Plus className="size-3.5" />
                          New Deal
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <DealsList deals={openDeals} dealStages={dealStages} />
              )}
            </TabsContent>

            <TabsContent value="tickets" className="mt-0 space-y-3">
              {ticketsPending ? (
                <p className="text-sm text-muted-foreground">Loading tickets…</p>
              ) : tickets.length === 0 ? (
                <EmptyBlock
                  message="No support tickets for this company."
                  action={
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link
                        to={`/tickets/create?company_id=${encodeURIComponent(String(company.id))}`}
                      >
                        <Plus className="size-3.5" />
                        New Ticket
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <TicketsList tickets={tickets} />
              )}
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              {contactsPending ? (
                <p className="text-sm text-muted-foreground">Loading contacts…</p>
              ) : contacts.length === 0 ? (
                <EmptyBlock
                  icon={<Building2 className="size-8 opacity-50" />}
                  message="No contacts linked to this company yet."
                />
              ) : (
                <ul className="divide-y overflow-hidden rounded-xl border border-border">
                  {contacts.map((contact) => (
                    <CompanyContactRow
                      key={String(contact.id)}
                      contact={contact}
                      onOpen={() => openPerson(contact)}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const PreviewTabTrigger = ({
  value,
  label,
  count,
}: {
  value: PreviewTab;
  label: string;
  count?: number;
}) => (
  <TabsTrigger
    value={value}
    className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
  >
    {label}
    {count != null && count > 0 ? ` (${count})` : ""}
  </TabsTrigger>
);

const PreviewChrome = ({
  title,
  onClose,
  fullViewPath,
  newDealPath,
}: {
  title: string;
  onClose: () => void;
  fullViewPath: string;
  newDealPath?: string;
}) => (
  <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
    <div className="flex min-w-0 items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onClose}
        aria-label="Close preview"
      >
        <PanelRightClose className="size-4" />
      </Button>
      <p className="truncate text-base font-semibold">{title}</p>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {newDealPath ? (
        <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
          <Link to={newDealPath}>
            <Plus className="size-3.5" />
            New Deal
          </Link>
        </Button>
      ) : null}
      <Button
        variant="default"
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        asChild
      >
        <Link to={fullViewPath}>
          View full
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  </div>
);

const EmptyBlock = ({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
    {icon}
    <p>{message}</p>
    {action}
  </div>
);

const DealsList = ({
  deals,
  dealStages,
}: {
  deals: Deal[];
  dealStages: ReturnType<typeof useConfigurationContext>["dealStages"];
}) => (
  <ul className="divide-y overflow-hidden rounded-lg border border-border">
    {deals.map((deal) => (
      <li key={deal.id}>
        <Link
          to={`/deals/${deal.id}/show`}
          className="block px-3 py-2.5 transition-colors hover:bg-muted/60"
        >
          <p className="truncate text-sm font-medium">{deal.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] capitalize">
              {findDealLabel(dealStages, deal.stage)}
            </Badge>
            <MoneyText value={deal.amount} />
          </div>
        </Link>
      </li>
    ))}
  </ul>
);

const TicketsList = ({ tickets }: { tickets: Ticket[] }) => (
  <ul className="divide-y overflow-hidden rounded-lg border border-border">
    {tickets.map((ticket) => (
      <li key={ticket.id}>
        <Link
          to={`/tickets/${ticket.id}/show`}
          className="block px-3 py-2.5 transition-colors hover:bg-muted/60"
        >
          <p className="truncate text-sm font-medium">
            {ticket.subject ?? `Ticket #${ticket.id}`}
          </p>
          {ticket.status ? (
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {ticket.status.replace(/_/g, " ")}
            </p>
          ) : null}
        </Link>
      </li>
    ))}
  </ul>
);

const CompanyContactRow = ({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: () => void;
}) => {
  const isLead = isLeadLifecycleStatus(contact.status);
  const stage = isLead
    ? getLeadStageDef(normalizeLeadStage(contact.lead_stage))
    : null;
  const email = getContactEmail(contact);
  const phone = getContactPhoneRaw(contact);

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
        onClick={onOpen}
      >
        <Avatar record={contact} width={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {getContactFullName(contact)}
            </span>
            {contact.is_primary_contact ? (
              <Badge variant="outline" className="font-normal">
                Primary
              </Badge>
            ) : null}
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
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[phone, email !== "—" ? email : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
      </button>
    </li>
  );
};
