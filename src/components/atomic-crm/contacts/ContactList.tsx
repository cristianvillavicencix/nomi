import jsonExport from "jsonexport/dist";
import {
  downloadCSV,
  FilterLiveForm,
  InfiniteListBase,
  useGetIdentity,
  useListContext,
  useListFilterContext,
  type Exporter,
} from "ra-core";
import { useEffect, useState } from "react";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { SortButton } from "@/components/admin/sort-button";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";

import type { Company, Contact, Sale, Tag } from "../types";
import { ContactEmpty } from "./ContactEmpty";
import { ContactImportButton } from "./ContactImportButton";
import { ContactListContentMobile } from "./ContactListContent";
import { Avatar } from "./Avatar";
import {
  ContactListFilterSummary,
  ContactListFilter,
} from "./ContactListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { ModuleInfoPopover } from "../layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "../layout/SpotlightSearchButton";
import { InfinitePagination } from "../misc/InfinitePagination";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";

const showSidebar = false;
const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "—";

export const ContactList = () => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <List
      title={false}
      disableBreadcrumb
      actions={<ContactListActions />}
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
    >
      <ContactListLayoutDesktop />
    </List>
  );
};

const ContactListLayoutDesktop = () => {
  const { data, isPending, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div className="w-full flex flex-row gap-8">
      {showSidebar ? <ContactListFilter /> : null}
      <div className="w-full">
        <DataTable rowClick="show" rowClassName={() => "[&_td]:py-2.5"}>
          <DataTable.Col
            label=""
            disableSort
            className="w-[52px]"
            cellClassName="w-[52px]"
            render={(record: Contact) => <Avatar record={record} width={25} />}
          />
          <DataTable.Col
            source="first_name"
            label="Contact"
            className="w-[30%]"
            cellClassName="w-[30%]"
            render={(record: Contact) =>
              `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "—"
            }
          />
          <DataTable.Col
            source="company_name"
            label="Company"
            className="w-[22%]"
            cellClassName="w-[22%] text-xs text-muted-foreground"
          />
          <DataTable.Col
            source="phone_jsonb"
            label="Phone"
            className="w-[13%]"
            cellClassName="w-[13%] text-xs text-muted-foreground"
            render={(record: Contact) => getPrimaryPhone(record)}
          />
          <DataTable.Col
            source="email_jsonb"
            label="Email"
            className="w-[15%]"
            cellClassName="w-[15%] text-xs text-muted-foreground"
            render={(record: Contact) => getPrimaryEmail(record)}
          />
          <DataTable.Col
            source="address"
            label="Address"
            className="w-[20%]"
            cellClassName="w-[20%] text-xs text-muted-foreground"
          />
        </DataTable>
      </div>
      <BulkActionsToolbar />
    </div>
  );
};

const ContactListActions = () => {
  const { identity } = useGetIdentity();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");
  const [query, setQuery] = useState(() =>
    typeof filterValues.q === "string" ? filterValues.q : "",
  );

  useEffect(() => {
    setQuery(typeof filterValues.q === "string" ? filterValues.q : "");
  }, [filterValues.q]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentQ = typeof filterValues.q === "string" ? filterValues.q : undefined;
      const nextQ = query.trim() ? query : undefined;
      if (currentQ === nextQ) {
        return;
      }
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
    <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SpotlightSearchButton
          title="Search Contacts"
          description="Find contacts by name or company without leaving the page."
          placeholder="Search name, company..."
          value={query}
          onValueChange={setQuery}
        />
        <SortButton fields={["first_name", "last_name", "last_seen"]} />
        {canManageSales ? <ContactImportButton /> : null}
        <ExportButton exporter={exporter} />
        {canManageSales ? <CreateButton /> : null}
        <ModuleInfoPopover
          title="Contacts"
          description="Your clean, searchable directory of clients and stakeholders."
        />
      </div>
    </TopToolbar>
  );
};

export const ContactListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
      queryOptions={{
        onError: () => {
          /* Disable error notification as ContactListLayoutMobile handles it */
        },
      }}
    >
      <ContactListLayoutMobile />
    </InfiniteListBase>
  );
};

const ContactListLayoutMobile = () => {
  const { isPending, data, error, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!isPending && !data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div>
      <MobileHeader>
        <div className="w-full">
          <FilterLiveForm>
            <SearchInput
              source="q"
              placeholder="Search name, company..."
              className="w-full"
            />
          </FilterLiveForm>
        </div>
      </MobileHeader>
      <MobileContent>
        {showSidebar ? <ContactListFilterSummary /> : null}
        <ContactListContentMobile />
        {!error && (
          <div className="flex justify-center">
            <InfinitePagination />
          </div>
        )}
      </MobileContent>
    </div>
  );
};

const exporter: Exporter<Contact> = async (records, fetchRelatedRecords) => {
  const companies = await fetchRelatedRecords<Company>(
    records,
    "company_id",
    "companies",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");
  const tags = await fetchRelatedRecords<Tag>(records, "tags", "tags");

  const contacts = records.map((contact) => {
    const exportedContact = {
      ...contact,
      company:
        contact.company_id != null
          ? companies[contact.company_id].name
          : undefined,
      sales: `${sales[contact.sales_id].first_name} ${
        sales[contact.sales_id].last_name
      }`,
      tags: contact.tags.map((tagId) => tags[tagId].name).join(", "),
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      email_fts: undefined,
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
      phone_fts: undefined,
    };
    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;
    return exportedContact;
  });
  return jsonExport(contacts, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "contacts");
  });
};
