import type { ReactNode } from "react";
import { useState } from "react";
import {
  MoreHorizontal,
  MessageSquare,
  Pencil,
  Star,
  Trash,
  UserRound,
} from "lucide-react";
import {
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/admin/confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { Status } from "@/components/atomic-crm/misc/Status";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { ContactEditModal } from "@/components/atomic-crm/contacts/ContactEditModal";
import { ContactShowSheet } from "@/lbs/clients/ContactShowSheet";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/lbs/clients/clientShowUtils";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useMessagesQuickAccess } from "@/lbs/messages/MessagesQuickAccessProvider";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import {
  CONTACT_STATUS_FILTER,
  LEAD_STATUS_FILTER,
} from "@/lbs/shared/relatedFilters";

type ClientContactsTabProps = {
  companyId: Company["id"];
  primaryContactId?: CompanyWithPrimaryContact["primary_contact_id"];
  statusFilter?: "all" | "contacts" | "leads";
};

export const ClientContactsTab = ({
  companyId,
  primaryContactId,
  statusFilter = "all",
}: ClientContactsTabProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending: isUpdatingPrimary }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete<Contact>();
  const statusInFilter =
    statusFilter === "leads"
      ? LEAD_STATUS_FILTER
      : statusFilter === "contacts"
        ? CONTACT_STATUS_FILTER
        : undefined;

  const { data: contacts = [], isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        ...(statusInFilter ? { "status@in": statusInFilter } : {}),
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );
  const [selectedContactId, setSelectedContactId] = useState<Identifier | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editContactId, setEditContactId] = useState<Identifier | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const { smsEnabled } = useMessagingEnabled();
  const { openSms, isOpening: isOpeningSms } = useMessagesQuickAccess();

  const openContact = (contactId: Identifier) => {
    setSelectedContactId(contactId);
    setSheetOpen(true);
  };

  const openEdit = (contactId: Identifier) => {
    setEditContactId(contactId);
    setEditOpen(true);
  };

  const setPrimaryContact = (contactId: Identifier) => {
    update(
      "companies",
      {
        id: companyId,
        data: { primary_contact_id: contactId },
        previousData: { id: companyId, primary_contact_id: primaryContactId },
      },
      {
        onSuccess: () => {
          notify("Primary contact updated");
          refresh();
        },
        onError: () => {
          notify("Failed to update primary contact", { type: "error" });
        },
      },
    );
  };

  const deleteContact = () => {
    if (!deleteTarget) return;
    deleteOne(
      "contacts",
      { id: deleteTarget.id, previousData: deleteTarget },
      {
        onSuccess: () => {
          notify("Contact deleted", { type: "info" });
          refresh();
          setDeleteTarget(null);
        },
        onError: () => {
          notify("Failed to delete contact", { type: "error" });
        },
      },
    );
  };

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <>
      {contacts.length === 0 ? (
        <ClientTabEmpty message="No contacts linked to this client. Use the + button above to add one." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Primary</TableHead>
                <TableHead className="w-[72px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const isPrimary =
                  String(contact.id) === String(primaryContactId);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left hover:underline"
                        onClick={() => openContact(contact.id)}
                      >
                        <Avatar record={contact} width={25} />
                        <span className="font-medium">
                          {getContactFullName(contact)}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {getContactPhone(contact)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      <span className="break-all">
                        {getContactEmail(contact)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {contact.status ? (
                        <Status status={contact.status} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {isPrimary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Contact actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openContact(contact.id)}
                          >
                            <UserRound className="size-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEdit(contact.id)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {smsEnabled && contactHasSmsPhone(contact) ? (
                            <DropdownMenuItem
                              disabled={isOpeningSms}
                              onClick={() => void openSms(contact)}
                            >
                              <MessageSquare className="size-4" />
                              Send SMS
                            </DropdownMenuItem>
                          ) : null}
                          {!isPrimary ? (
                            <DropdownMenuItem
                              disabled={isUpdatingPrimary}
                              onClick={() => setPrimaryContact(contact.id)}
                            >
                              <Star className="size-4" />
                              Set as primary
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={() => setDeleteTarget(contact)}
                          >
                            <Trash className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ContactShowSheet
        contactId={selectedContactId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
      {editContactId ? (
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
        onConfirm={deleteContact}
        onClose={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </>
  );
};

export const ClientTabEmpty = ({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 py-10 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    {action}
  </div>
);
