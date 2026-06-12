import { useEffect, useState } from "react";
import {
  useDelete,
  useGetIdentity,
  useListContext,
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
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { ContactEditModal } from "@/components/atomic-crm/contacts/ContactEditModal";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { LBS_CONTACT_STATUSES } from "@/app/navigation";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "—";

export const ContactsListPage = () => {
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
          "status@in": `(${LBS_CONTACT_STATUSES.map((s) => `"${s}"`).join(",")})`,
        }}
        actions={
          <PageActions>
            <PageTitle label="Contacts" />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactDialogOpen(true)}
              >
                <Plus className="size-4" />
                New contact
              </Button>
              <ModuleInfoPopover
                title="Contacts"
                description="People linked to client companies. Click a column header to sort."
              />
            </div>
          </PageActions>
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <ContactsLayout />
      </List>
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </div>
  );
};

const ContactsLayout = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { data, isPending, filterValues } = useListContext<Contact>();
  const [editContactId, setEditContactId] = useState<Identifier | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleteOne, { isPending: isDeleting }] = useDelete<Contact>();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

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

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No contacts yet. Add contacts from a company profile or create one here.
      </div>
    );
  }

  return (
    <>
      <DataTable
        rowClick={(_id, _resource, record) =>
          getPersonShowPath(record as Contact)
        }
        rowClassName={() => "[&_td]:py-2.5 [&_td]:leading-normal"}
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
          source="company_name"
          label="Company"
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
        <ContactEditModal
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
    </>
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
