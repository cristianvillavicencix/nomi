import { useEffect, useState } from "react";
import {
  useDelete,
  useGetIdentity,
  useListContext,
  useListFilterContext,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { MoreHorizontal, Pencil, Plus, Trash } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/admin/confirm";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { OpenMailComposeLink } from "@/modules/mail/OpenMailComposeLink";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { LBS_CONTACT_STATUSES_FOR_FILTER } from "@/app/navigation";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "—";

export const ContactsListPage = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "contact") {
      setContactDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      <List
        resource="contacts"
        title={false}
        disableBreadcrumb
        perPage={25}
        sort={{ field: "last_name", order: "ASC" }}
        filter={{
          "status@in": `(${LBS_CONTACT_STATUSES_FOR_FILTER.map((s) => `"${s}"`).join(",")})`,
        }}
        actions={
          embedded ? (
            false
          ) : (
            <PageActions>
              <PageTitle label="Contacts" />
            </PageActions>
          )
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <ContactsLayout
          embedded={embedded}
          onNewContact={() => setContactDialogOpen(true)}
        />
      </List>
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  );
};

const ContactsLayout = ({
  embedded,
  onNewContact,
}: {
  embedded: boolean;
  onNewContact: () => void;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { data, total, isPending, filterValues } = useListContext<Contact>();
  const { setFilters } = useListFilterContext();
  const [editContactId, setEditContactId] = useState<Identifier | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleteOne, { isPending: isDeleting }] = useDelete<Contact>();
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

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  const toolbar = !embedded ? (
    <ModuleToolbar className="shrink-0">
      <ModuleSearchField
        value={searchDraft}
        onChange={setSearchDraft}
        basePlaceholder="Search contacts by name, email, or phone"
        total={total}
        itemSingular="contact"
      />
      <ModuleToolbarActions>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNewContact}
          aria-label="New contact"
        >
          <Plus className="size-4" />
          New contact
        </Button>
      </ModuleToolbarActions>
    </ModuleToolbar>
  ) : null;

  const openEdit = (contactId: Identifier) => {
    setEditContactId(contactId);
    setEditOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteOne(
      "contacts",
      { id: deleteTarget.id, previousData: deleteTarget },
      {
        onSuccess: () => {
          notify("Contact deleted", { type: "info" });
          setDeleteTarget(null);
          refresh();
        },
        onError: () => {
          notify("Failed to delete contact", { type: "error" });
        },
      },
    );
  };

  if (isPending) return toolbar;
  if (!data?.length && !hasFilters) {
    return (
      <div className="space-y-3">
        {toolbar}
        <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No contacts yet. Add contacts from a company profile or create one here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      <DataTable
        rowClick={(_id, _resource, record) =>
          getPersonShowPath(record as Contact)
        }
        rowClassName={() => "[&_td]:py-1.5 [&_td]:leading-normal"}
      >
        <DataTable.Col
          source="last_name"
          label="Full name"
          render={(record: Contact) => (
            <span className="font-medium">{getContactFullName(record)}</span>
          )}
        />
        <DataTable.Col
          source="phone_jsonb"
          label="Phone"
          disableSort
          render={(record: Contact) => (
            <CrmPhoneLink
              phone={getPrimaryPhone(record)}
              contactId={record.id}
              className="link-action"
            />
          )}
        />
        <DataTable.Col
          source="email_jsonb"
          label="Email"
          disableSort
          render={(record: Contact) => {
            const email = getPrimaryEmail(record);
            if (!email || email === "—") return email;
            return (
              <OpenMailComposeLink
                to={email}
                contactId={record.id}
                companyId={record.company_id ?? undefined}
                onClick={(event) => event.stopPropagation()}
              >
                {email}
              </OpenMailComposeLink>
            );
          }}
        />
        <DataTable.Col
          source="company_name"
          label="Account"
          render={(record: Contact) => {
            const name = record.company_name?.trim() || "—";
            const companyId = record.company_id;
            if (!companyId || name === "—") return name;
            return (
              <Link
                to={getClientShowPath(companyId)}
                className="link-action"
                onClick={(event) => event.stopPropagation()}
              >
                {name}
              </Link>
            );
          }}
        />
        <DataTable.Col
          label=""
          disableSort
          className="w-10"
          cellClassName="w-10 py-0 text-right"
          headerClassName="text-right"
          render={(record: Contact) => (
            <ContactRowActions
              onEdit={() => openEdit(record.id)}
              onDelete={() => setDeleteTarget(record)}
            />
          )}
        />
      </DataTable>

      {editContactId != null ? (
        <ContactFormDialog
          contactId={editContactId}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditContactId(null);
          }}
        />
      ) : null}

      <Confirm
        isOpen={!!deleteTarget}
        title="Delete this contact?"
        content="This action cannot be undone."
        confirm="Delete"
        confirmColor="warning"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </div>
  );
};

const ContactRowActions = ({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div
    className="flex h-6 items-center justify-end"
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Contact actions</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
