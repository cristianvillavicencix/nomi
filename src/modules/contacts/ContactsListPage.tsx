import { useEffect, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import { InfinitePagination } from "@/components/atomic-crm/misc/InfinitePagination";
import { Status } from "@/components/atomic-crm/misc/Status";
import type { Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { LBS_CONTACT_STATUSES_FOR_FILTER } from "@/app/navigation";
import { getContactShowPath } from "@/app/routing";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => String(phone.number ?? "").trim())
    ?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => String(email.email ?? "").trim())
    ?.email ?? "—";

export const ContactsListPage = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="contacts"
      storeKey="contacts.listParams"
      title={false}
      disableBreadcrumb
      perPage={25}
      sort={{ field: "last_name", order: "ASC" }}
      filterDefaultValues={{
        "status@in": `(${LBS_CONTACT_STATUSES_FOR_FILTER.map((status) => `"${status}"`).join(",")})`,
      }}
      actions={
        <PageActions>
          <PageTitle label="Contacts" />
        </PageActions>
      }
    >
      <ContactsListLayout />
    </List>
  );
};

const ContactsListLayout = () => {
  const { data, total, isPending, filterValues } = useListContext<Contact>();
  const { setFilters } = useListFilterContext();
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

  const toolbar = (
    <ModuleToolbar className="shrink-0">
      <ModuleSearchField
        value={searchDraft}
        onChange={setSearchDraft}
        basePlaceholder="Search contacts by name, email, or phone"
        total={total}
        itemSingular="contact"
      />
      <ModuleToolbarActions>
        <SortButton fields={["first_name", "last_name", "company_name"]} />
      </ModuleToolbarActions>
    </ModuleToolbar>
  );

  if (isPending) return toolbar;
  if (!data?.length) {
    return (
      <div className="space-y-3">
        {toolbar}
        <ContactEmpty />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      <DataTable
        rowClick={(_id, _resource, record) => getContactShowPath(record.id)}
        rowClassName={() => "[&_td]:py-1.5"}
      >
        <DataTable.Col
          label=""
          disableSort
          className="w-[52px]"
          render={(record: Contact) => <Avatar record={record} width={25} />}
        />
        <DataTable.Col
          source="last_name"
          label="Full Name"
          render={(record: Contact) =>
            `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "—"
          }
        />
        <DataTable.Col source="company_name" label="Company" />
        <DataTable.Col source="title" label="Role / Title" />
        <DataTable.Col
          source="phone_jsonb"
          label="Phone"
          render={(record: Contact) => getPrimaryPhone(record)}
        />
        <DataTable.Col
          source="email_jsonb"
          label="Email"
          render={(record: Contact) => getPrimaryEmail(record)}
        />
        <DataTable.Col
          source="status"
          label="Status"
          render={(record: Contact) => <Status status={record.status} />}
        />
        <DataTable.Col
          label="Primary"
          disableSort
          render={(record: Contact) =>
            record.is_primary_contact ? (
              <Badge variant="secondary">Primary</Badge>
            ) : (
              "—"
            )
          }
        />
      </DataTable>
      <InfinitePagination />
    </div>
  );
};
