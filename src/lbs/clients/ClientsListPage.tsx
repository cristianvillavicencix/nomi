import { useGetIdentity, useListContext } from "ra-core";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
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

const CompaniesActions = () => (
  <PageActions>
    <PageTitle label="Clients" />
    <ClientsTabsBar />
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <SortButton fields={["name", "website"]} />
      <Link
        to={getClientCreatePath()}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Plus className="size-4" />
        New client
      </Link>
      <ModuleInfoPopover
        title="Clients"
        description="Business profiles with linked contacts, projects, contracts, and support."
      />
    </div>
  </PageActions>
);

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

const ContactsActions = () => (
  <PageActions>
    <PageTitle label="Clients" />
    <ClientsTabsBar />
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <SortButton fields={["first_name", "last_name", "last_seen"]} />
      <ModuleInfoPopover
        title="Contacts"
        description="Every person linked to a client company. New contacts are added from the client profile."
      />
    </div>
  </PageActions>
);

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
