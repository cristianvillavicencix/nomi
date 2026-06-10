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
import { useSearchParams } from "react-router";
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
import { CompanyEmpty } from "@/components/atomic-crm/companies/CompanyEmpty";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import {
  collectBusinessSocialLinks,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneForDisplay,
} from "@/lbs/clients/companyChannelResolvers";
import { ClientEditDialog } from "@/lbs/clients/ClientEditDialog";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { mailtoHref, normalizePhoneForTel } from "@/lib/linking";
import { getClientShowPath } from "@/lbs/routing";
import { NewClientDialog } from "@/lbs/clients/NewClientDialog";

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getCompanyListEmail = (record: CompanyWithPrimaryContact) =>
  resolveCompanyEmailForDisplay(record);

export const CompaniesListPage = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "company") {
      setClientDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!identity) return null;

  return (
    <div className="w-full space-y-3">
      <List
        resource="companies"
        title={false}
        disableBreadcrumb
        perPage={25}
        sort={{ field: "name", order: "ASC" }}
        actions={
          <PageActions>
            <PageTitle label="Companies" />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClientDialogOpen(true)}
              >
                <Plus className="size-4" />
                New company
              </Button>
              <ModuleInfoPopover
                title="Companies"
                description="Client companies with contact details, website, and social links. Click a column header to sort."
              />
            </div>
          </PageActions>
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <CompaniesLayout />
      </List>
      <NewClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
      />
    </div>
  );
};

const CompaniesLayout = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { data, isPending, filterValues } =
    useListContext<CompanyWithPrimaryContact>();
  const [editCompanyId, setEditCompanyId] = useState<Identifier | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<CompanyWithPrimaryContact | null>(null);
  const [deleteOne, { isPending: isDeleting }] = useDelete();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  const openEdit = (companyId: Identifier) => {
    setEditCompanyId(companyId);
    setEditOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteOne(
      "companies",
      { id: deleteTarget.id, previousData: deleteTarget },
      {
        onSuccess: () => {
          notify("Company deleted", { type: "info" });
          setDeleteTarget(null);
          refresh();
        },
        onError: () => {
          notify("Failed to delete company", { type: "error" });
        },
      },
    );
  };

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <>
      <DataTable
        rowClick={(_id, _resource, record) => getClientShowPath(record.id)}
        rowClassName={() => "[&_td]:py-2.5 [&_td]:leading-normal"}
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
          label="Company"
          render={(record: CompanyWithPrimaryContact) => (
            <span className="font-medium">{record.name?.trim() || "—"}</span>
          )}
        />
        <DataTable.Col
          source="phone_number"
          label="Phone"
          render={(record: CompanyWithPrimaryContact) => {
            const { display, telHref } = normalizePhoneForTel(
              resolveCompanyPhoneForDisplay(record),
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
          source="primary_contact_email_jsonb"
          label="Email"
          render={(record: CompanyWithPrimaryContact) => {
            const email = getCompanyListEmail(record);
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
          source="website"
          label="Website"
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
          label="Social"
          disableSort
          render={(record: CompanyWithPrimaryContact) => {
            const links = collectBusinessSocialLinks(record);
            if (links.length === 0) return "—";
            return (
              <ClientSocialLinksDisplay
                links={links}
                stopPropagation
                className="flex-nowrap gap-2"
                iconClassName="size-4"
              />
            );
          }}
        />
        <DataTable.Col
          label=""
          disableSort
          className="w-10"
          cellClassName="w-10 py-0 text-right"
          headerClassName="text-right"
          render={(record: CompanyWithPrimaryContact) => (
            <CompanyRowActions
              onEdit={() => openEdit(record.id)}
              onDelete={() => setDeleteTarget(record)}
            />
          )}
        />
      </DataTable>

      {editCompanyId != null ? (
        <ClientEditDialog
          companyId={editCompanyId}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditCompanyId(null);
          }}
        />
      ) : null}

      <Confirm
        isOpen={!!deleteTarget}
        title="Delete this company?"
        content="This removes the company record. Linked contacts and projects may remain in the system."
        confirm="Delete"
        confirmColor="warning"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </>
  );
};

const CompanyRowActions = ({
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
          <span className="sr-only">Company actions</span>
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
