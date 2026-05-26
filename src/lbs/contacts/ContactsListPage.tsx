import { useGetIdentity, useListContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import { InfinitePagination } from "@/components/atomic-crm/misc/InfinitePagination";
import { Status } from "@/components/atomic-crm/misc/Status";
import type { Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { LBS_CONTACT_STATUSES } from "@/lbs/navigation";
import { getContactShowPath } from "@/lbs/routing";

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
      title="Contacts"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "last_name", order: "ASC" }}
      filterDefaultValues={{
        "status@in": `(${LBS_CONTACT_STATUSES.map((status) => `"${status}"`).join(",")})`,
      }}
      actions={<ContactsListActions />}
    >
      <ContactsListLayout />
    </List>
  );
};

const ContactsListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <SpotlightSearchButton />
    <SortButton fields={["first_name", "last_name", "company_name"]} />
    <ModuleInfoPopover
      title="Contacts"
      description="People linked to client companies, including primary contacts."
    />
  </TopToolbar>
);

const ContactsListLayout = () => {
  const { data, isPending } = useListContext<Contact>();

  if (isPending) return null;
  if (!data?.length) return <ContactEmpty />;

  return (
    <>
      <DataTable
        rowClick={(_id, _resource, record) => getContactShowPath(record.id)}
        rowClassName={() => "[&_td]:py-2.5"}
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
    </>
  );
};
