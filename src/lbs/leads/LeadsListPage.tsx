import { useGetIdentity, useListContext } from "ra-core";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import { InfinitePagination } from "@/components/atomic-crm/misc/InfinitePagination";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";
import { getLeadShowPath } from "@/lbs/routing";
import { Status } from "@/components/atomic-crm/misc/Status";
import { cn } from "@/lib/utils";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => String(phone.number ?? "").trim())
    ?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => String(email.email ?? "").trim())
    ?.email ?? "—";

export const LeadsListPage = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="contacts"
      title="Leads"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      filterDefaultValues={{
        "status@in": `(${LBS_LEAD_STATUSES.map((status) => `"${status}"`).join(",")})`,
      }}
      actions={<LeadsListActions />}
    >
      <LeadsListLayout />
    </List>
  );
};

const LeadsListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <SpotlightSearchButton
      title="Search Leads"
      description="Find leads by name, company, email, or phone."
      placeholder="Search leads..."
    />
    <SortButton fields={["first_name", "last_name", "last_seen"]} />
    <Link
      to="/leads/create"
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      <Plus />
      New lead
    </Link>
    <ModuleInfoPopover
      title="Leads"
      description="Potential opportunities before they become client contacts."
    />
  </TopToolbar>
);

const LeadsListLayout = () => {
  const { data, isPending } = useListContext<Contact>();

  if (isPending) return null;
  if (!data?.length) return <ContactEmpty />;

  return (
    <>
      <DataTable
        rowClick={(_id, _resource, record) => getLeadShowPath(record.id)}
        rowClassName={() => "[&_td]:py-2.5"}
      >
        <DataTable.Col
          label=""
          disableSort
          className="w-[52px]"
          render={(record: Contact) => <Avatar record={record} width={25} />}
        />
        <DataTable.Col
          source="first_name"
          label="Full Name"
          render={(record: Contact) =>
            `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "—"
          }
        />
        <DataTable.Col
          source="company_name"
          label="Business Name"
          render={(record: Contact) => record.company_name?.trim() || "—"}
        />
        <DataTable.Col
          source="interested_service"
          label="Interested Service"
          render={(record: Contact) => record.interested_service ?? "—"}
        />
        <DataTable.Col
          source="lead_source"
          label="Lead Source"
          render={(record: Contact) => record.lead_source ?? "—"}
        />
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
      </DataTable>
      <InfinitePagination />
    </>
  );
};
