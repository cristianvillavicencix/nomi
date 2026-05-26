import { useEffect, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { CompanyEmpty } from "@/components/atomic-crm/companies/CompanyEmpty";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { Avatar as ContactAvatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  collectBusinessSocialLinks,
  collectClientEmails,
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { cn } from "@/lib/utils";
import {
  getClientCreatePath,
  getClientShowPath,
  getPersonShowPath,
} from "@/lbs/routing";
import { LBS_CONTACT_STATUSES } from "@/lbs/navigation";

const CLIENTS_TABS = ["companies", "contacts"] as const;
type ClientsTab = (typeof CLIENTS_TABS)[number];

const parseTab = (raw: string | null): ClientsTab =>
  raw === "contacts" ? "contacts" : "companies";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "—";

// Shared tab switcher rendered inside each tab's toolbar, so the tabs and the
// search/sort/actions live on the same row and the data table can shift up.
const ClientsTabsBar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab"));

  const handleTabChange = (next: string) => {
    if (!(CLIENTS_TABS as readonly string[]).includes(next)) return;
    const nextParams = new URLSearchParams(searchParams);
    if (next === "companies") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="companies">Empresas</TabsTrigger>
        <TabsTrigger value="contacts">Contactos</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export const ClientsListPage = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab"));

  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      {currentTab === "companies" ? <CompaniesTab /> : <ContactsTab />}
    </div>
  );
};

// ---------------- Empresas (companies) tab ----------------

const CompaniesTab = () => (
  <List
    resource="companies"
    title={false}
    disableBreadcrumb
    perPage={25}
    sort={{ field: "name", order: "ASC" }}
    actions={<CompaniesActions />}
    pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
  >
    <CompaniesLayout />
  </List>
);

const CompaniesActions = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const [query, setQuery] = useState(() =>
    typeof filterValues.q === "string" ? filterValues.q : "",
  );

  useEffect(() => {
    setQuery(typeof filterValues.q === "string" ? filterValues.q : "");
  }, [filterValues.q]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentQ =
        typeof filterValues.q === "string" ? filterValues.q : undefined;
      const nextQ = query.trim() ? query : undefined;
      if (currentQ === nextQ) return;
      const nextFilterValues = { ...filterValues };
      if (nextQ) {
        nextFilterValues.q = nextQ;
      } else {
        delete nextFilterValues.q;
      }
      setFilters(nextFilterValues, displayedFilters);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [displayedFilters, filterValues, query, setFilters]);

  return (
    <TopToolbar className="w-full flex-wrap items-center gap-3">
      <ClientsTabsBar />
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <SpotlightSearchButton
          title="Buscar clientes"
          placeholder="Buscar por nombre, web o sector…"
          value={query}
          onValueChange={setQuery}
          resource="companies"
          getHref={(record) => getClientShowPath(record.id)}
          renderItem={(record) => {
            const company = record as Company;
            return (
              <>
                <CompanyAvatar record={company} width={28} height={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {company.name || "Sin nombre"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[company.sector, company.website]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </>
            );
          }}
        />
        <SortButton fields={["name", "website"]} />
        <Link
          to={getClientCreatePath()}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Plus />
          New client
        </Link>
        <ModuleInfoPopover
          title="Clients"
          description="Business profiles with linked contacts, projects, contracts, and support."
        />
      </div>
    </TopToolbar>
  );
};

const CompaniesLayout = () => {
  const { data, isPending, filterValues } =
    useListContext<CompanyWithPrimaryContact>();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <DataTable
      rowClick={(_id, _resource, record) => getClientShowPath(record.id)}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col
        label=""
        disableSort
        className="w-[52px]"
        render={(record: Company) => (
          <CompanyAvatar record={record} width={25} />
        )}
      />
      <DataTable.Col
        source="name"
        label="Business name"
        render={(record: CompanyWithPrimaryContact) => (
          <span className="font-medium">{record.name?.trim() || "—"}</span>
        )}
      />
      <DataTable.Col
        source="primary_contact_last_name"
        label="Client"
        render={(record: CompanyWithPrimaryContact) =>
          getPrimaryContactFullName(record)
        }
      />
      <DataTable.Col
        source="primary_contact_phone_jsonb"
        label="Phone"
        render={(record: CompanyWithPrimaryContact) =>
          getPrimaryContactPhone(record)
        }
      />
      <DataTable.Col
        source="primary_contact_email_jsonb"
        label="Email"
        render={(record: CompanyWithPrimaryContact) =>
          collectClientEmails(record)[0]?.email ?? "—"
        }
      />
      <DataTable.Col
        source="website"
        label="Website"
        render={(record: CompanyWithPrimaryContact) =>
          record.website?.trim() || "—"
        }
      />
      <DataTable.Col
        source="linkedin_url"
        label="Social media"
        disableSort
        render={(record: CompanyWithPrimaryContact) => {
          const links = collectBusinessSocialLinks(record);
          if (links.length === 0) return "—";
          return (
            <ClientSocialLinksDisplay
              links={links}
              stopPropagation
              iconClassName="size-4"
            />
          );
        }}
      />
    </DataTable>
  );
};

// ---------------- Contactos (contacts) tab ----------------

const ContactsTab = () => (
  <List
    resource="contacts"
    title={false}
    disableBreadcrumb
    perPage={25}
    sort={{ field: "last_seen", order: "DESC" }}
    filter={{
      "status@in": `(${LBS_CONTACT_STATUSES.map((s) => `"${s}"`).join(",")})`,
    }}
    actions={<ContactsActions />}
    pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
  >
    <ContactsLayout />
  </List>
);

const ContactsActions = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const [query, setQuery] = useState(() =>
    typeof filterValues.q === "string" ? filterValues.q : "",
  );

  useEffect(() => {
    setQuery(typeof filterValues.q === "string" ? filterValues.q : "");
  }, [filterValues.q]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentQ =
        typeof filterValues.q === "string" ? filterValues.q : undefined;
      const nextQ = query.trim() ? query : undefined;
      if (currentQ === nextQ) return;
      const nextFilterValues = { ...filterValues };
      if (nextQ) {
        nextFilterValues.q = nextQ;
      } else {
        delete nextFilterValues.q;
      }
      setFilters(nextFilterValues, displayedFilters);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [displayedFilters, filterValues, query, setFilters]);

  return (
    <TopToolbar className="w-full flex-wrap items-center gap-3">
      <ClientsTabsBar />
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <SpotlightSearchButton
          title="Buscar contactos"
          placeholder="Buscar por nombre, empresa, email o teléfono…"
          value={query}
          onValueChange={setQuery}
          resource="contacts"
          filter={{
            "status@in": `(${LBS_CONTACT_STATUSES.map((status) => `"${status}"`).join(",")})`,
          }}
          getHref={(record) => getPersonShowPath(record.id)}
          renderItem={(record) => {
            const contact = record as Contact;
            const name =
              `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
              contact.company_name ||
              "Sin nombre";
            return (
              <>
                <ContactAvatar record={contact} width={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[contact.company_name, contact.title]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </>
            );
          }}
        />
        <SortButton fields={["first_name", "last_name", "last_seen"]} />
        <ModuleInfoPopover
          title="Contacts"
          description="Every person linked to a client company. New contacts are added from the client profile."
        />
      </div>
    </TopToolbar>
  );
};

const ContactsLayout = () => {
  const { data, isPending, filterValues } = useListContext<Contact>();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No contacts yet. Add contacts from inside a client profile.
      </div>
    );
  }

  return (
    <DataTable
      rowClick={(_id, _resource, record) =>
        getPersonShowPath(record as Contact)
      }
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col
        label=""
        disableSort
        className="w-[52px]"
        render={(record: Contact) => (
          <ContactAvatar record={record} width={25} />
        )}
      />
      <DataTable.Col
        source="first_name"
        label="Contact"
        render={(record: Contact) =>
          `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "—"
        }
      />
      <DataTable.Col
        source="company_name"
        label="Company"
        render={(record: Contact) => record.company_name?.trim() || "—"}
      />
      <DataTable.Col
        source="phone_jsonb"
        label="Phone"
        disableSort
        render={(record: Contact) => getPrimaryPhone(record)}
      />
      <DataTable.Col
        source="email_jsonb"
        label="Email"
        disableSort
        render={(record: Contact) => getPrimaryEmail(record)}
      />
    </DataTable>
  );
};
