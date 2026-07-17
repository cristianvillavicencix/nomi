import { useGetIdentity, useGetList, useGetOne } from "ra-core";
import {
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  PanelRightClose,
  Plus,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  getClientDealCreatePath,
  getClientShowPath,
  getPersonShowPath,
} from "@/app/routing";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { resolveCompanyAddressForDisplay } from "@/modules/clients/clientAddressUtils";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import {
  getLeadStageDef,
  normalizeLeadStage,
} from "@/modules/leads/leadStages";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { mailtoHref } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { buildAccountsPersonPreviewParams } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { useIsMobile } from "@/hooks/use-mobile";

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

/** Compact company drawer: core fields + Contacts tab → person preview. */
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
  const { data: identity } = useGetIdentity();
  const canCreateDeal = canAccess(identity, {
    resource: "deals",
    action: "create",
  });

  const { data: company, isPending } = useGetOne<Company>(
    "companies",
    { id: companyId },
  );

  const { data: contacts = [], isPending: contactsPending } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
      filter: { "company_id@eq": companyId },
    },
    { enabled: Boolean(companyId) },
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
  const address = resolveCompanyAddressForDisplay(company);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <PreviewChrome
        title="Company Preview"
        onClose={onClose}
        fullViewPath={getClientShowPath(company.id)}
        newDealPath={
          canCreateDeal ? getClientDealCreatePath(company.id) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="mb-4 flex items-start gap-3">
          <CompanyAvatar record={company} width={48} />
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h2 className="truncate text-lg font-semibold">
                {company.name?.trim() || "Untitled company"}
              </h2>
              {company.is_client === true ? (
                <Badge variant="outline" className="font-normal">
                  Client
                </Badge>
              ) : null}
            </div>
            {website && websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm link-action"
              >
                <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{website}</span>
              </a>
            ) : null}
          </div>
        </div>

        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">Phone</dt>
            <dd className="min-w-0">
              <CrmPhoneLink phone={phone} className="link-action" />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">Email</dt>
            <dd className="min-w-0">
              {emailHref && email !== "—" ? (
                <a href={emailHref} className="link-action">
                  {email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          {address ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Address</dt>
              <dd className="min-w-0 text-muted-foreground">
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {address}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        <Tabs defaultValue="contacts">
          <TabsList className="mb-3 w-full justify-start">
            <TabsTrigger value="contacts">
              Contacts
              {contacts.length > 0 ? ` (${contacts.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contacts" className="mt-0">
            {contactsPending ? (
              <p className="text-sm text-muted-foreground">Loading contacts…</p>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <Building2 className="size-8 opacity-50" />
                No contacts linked to this company yet.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
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
  );
};

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
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60"
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
            {[phone, email].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </button>
    </li>
  );
};
