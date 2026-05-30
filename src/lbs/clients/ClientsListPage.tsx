import { useEffect, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
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
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { getContactFullName } from "@/lbs/clients/clientShowUtils";
import {
  getClientShowPath,
  getPersonShowPath,
} from "@/lbs/routing";
import { LBS_CONTACT_STATUSES } from "@/lbs/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewClientDialog } from "@/lbs/clients/NewClientDialog";
import { NewContactDialog } from "@/lbs/clients/NewContactDialog";

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const formatCreatedDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

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
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "company") {
      setClientDialogOpen(true);
    }
    if (searchParams.get("create") === "contact") {
      setContactDialogOpen(true);
    }
  }, [searchParams]);

  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      {currentTab === "companies" ? (
        <CompaniesTab onNewCompany={() => setClientDialogOpen(true)} />
      ) : (
        <ContactsTab onNewContact={() => setContactDialogOpen(true)} />
      )}
      <NewClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
      />
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  );
};

// ---------------- Empresas (companies) tab ----------------

const CompaniesTab = ({ onNewCompany }: { onNewCompany: () => void }) => (
  <List
    resource="companies"
    title={false}
    disableBreadcrumb
    perPage={25}
    sort={{ field: "name", order: "ASC" }}
    actions={<CompaniesActions onNewCompany={onNewCompany} />}
    pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
  >
    <CompaniesLayout />
  </List>
);

const CompaniesActions = ({ onNewCompany }: { onNewCompany: () => void }) => (
  <PageActions>
    <PageTitle label="Empresas" />
    <ClientsTabsBar />
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <SortButton fields={["name", "city", "created_at", "website"]} />
      <Button variant="outline" size="sm" onClick={onNewCompany}>
        <Plus className="size-4" />
        Nueva empresa
      </Button>
      <ModuleInfoPopover
        title="Empresas"
        description="Listado simple de empresas con contacto principal, teléfono, ciudad y web."
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
        cellClassName="w-[52px]"
        render={(record: CompanyWithPrimaryContact) => (
          <CompanyAvatar record={record} width={25} />
        )}
      />
      <DataTable.Col
        source="name"
        label="Empresa"
        render={(record: CompanyWithPrimaryContact) => (
          <span className="font-medium">{record.name?.trim() || "—"}</span>
        )}
      />
      <DataTable.Col
        source="primary_contact_last_name"
        label="Propietario / contacto"
        render={(record: CompanyWithPrimaryContact) =>
          getPrimaryContactFullName(record)
        }
      />
      <DataTable.Col
        source="primary_contact_phone_jsonb"
        label="Teléfono"
        render={(record: CompanyWithPrimaryContact) => {
          const { display, telHref } = normalizePhoneForTel(
            getPrimaryContactPhone(record),
          );
          if (!telHref || display === "—") return display;
          return (
            <a
              href={telHref}
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {display}
            </a>
          );
        }}
      />
      <DataTable.Col
        source="city"
        label="Ciudad"
        render={(record: CompanyWithPrimaryContact) =>
          record.city?.trim() || "—"
        }
      />
      <DataTable.Col
        source="website"
        label="Página web"
        render={(record: CompanyWithPrimaryContact) => {
          const website = String(record?.website ?? "").trim();
          const href = normalizeWebsiteHref(website);
          if (!website || !href) return "—";
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {website}
            </a>
          );
        }}
      />
      <DataTable.Col
        source="linkedin_url"
        label="Redes sociales"
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
      <DataTable.Col
        source="created_at"
        label="Fecha de creación"
        render={(record: CompanyWithPrimaryContact) =>
          formatCreatedDate(record.created_at)
        }
      />
    </DataTable>
  );
};

// ---------------- Contactos (contacts) tab ----------------

const ContactsTab = ({ onNewContact }: { onNewContact: () => void }) => (
  <List
    resource="contacts"
    title={false}
    disableBreadcrumb
    perPage={25}
    sort={{ field: "last_name", order: "ASC" }}
    filter={{
      "status@in": `(${LBS_CONTACT_STATUSES.map((s) => `"${s}"`).join(",")})`,
    }}
    actions={<ContactsActions onNewContact={onNewContact} />}
    pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
  >
    <ContactsLayout />
  </List>
);

const ContactsActions = ({ onNewContact }: { onNewContact: () => void }) => (
  <PageActions>
    <PageTitle label="Contactos" />
    <ClientsTabsBar />
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <SortButton
        fields={["last_name", "company_name", "first_seen", "last_seen"]}
      />
      <Button variant="outline" size="sm" onClick={onNewContact}>
        <Plus className="size-4" />
        Nuevo contacto
      </Button>
      <ModuleInfoPopover
        title="Contactos"
        description="Personas vinculadas a empresas cliente. También puedes agregar contactos desde el perfil de una empresa."
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
        cellClassName="w-[52px]"
        render={(record: Contact) => (
          <ContactAvatar record={record} width={25} />
        )}
      />
      <DataTable.Col
        source="last_name"
        label="Full name"
        render={(record: Contact) => (
          <span className="font-medium">{getContactFullName(record)}</span>
        )}
      />
      <DataTable.Col
        source="email_jsonb"
        label="Email"
        disableSort
        render={(record: Contact) => {
          const email = getPrimaryEmail(record);
          const href = mailtoHref(email);
          if (!href || email === "—") return email;
          return (
            <a
              href={href}
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {email}
            </a>
          );
        }}
      />
      <DataTable.Col
        source="phone_jsonb"
        label="Phone"
        disableSort
        render={(record: Contact) => {
          const { display, telHref } = normalizePhoneForTel(
            getPrimaryPhone(record),
          );
          if (!telHref || display === "—") return display;
          return (
            <a
              href={telHref}
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {display}
            </a>
          );
        }}
      />
      <DataTable.Col
        source="company_name"
        label="Company"
        render={(record: Contact) => record.company_name?.trim() || "—"}
      />
      <DataTable.Col
        source="first_seen"
        label="Created"
        render={(record: Contact) => formatCreatedDate(record.first_seen)}
      />
    </DataTable>
  );
};
