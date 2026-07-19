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
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { CompanyEmpty } from "@/components/atomic-crm/companies/CompanyEmpty";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import {
  collectBusinessSocialLinks,
  type CompanyWithPrimaryContact,
} from "@/modules/clients/clientProfile";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { ClientEditDialog } from "@/modules/clients/ClientEditDialog";
import { ClientSocialLinksDisplay } from "@/modules/clients/ClientSocialLinksDisplay";
import { mailtoHref } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { getClientShowPath } from "@/app/routing";
import { NewClientDialog } from "@/modules/clients/NewClientDialog";

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

export const CompaniesListPage = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
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
          embedded ? (
            false
          ) : (
            <PageActions>
              <PageTitle label="Companies" />
            </PageActions>
          )
        }
        pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      >
        <CompaniesLayout
          embedded={embedded}
          onNewCompany={() => setClientDialogOpen(true)}
        />
      </List>
      <NewClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
      />
    </div>
  );
};

const CompaniesLayout = ({
  embedded,
  onNewCompany,
}: {
  embedded: boolean;
  onNewCompany: () => void;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { data, total, isPending, filterValues } =
    useListContext<CompanyWithPrimaryContact>();
  const { setFilters } = useListFilterContext();
  const [editCompanyId, setEditCompanyId] = useState<Identifier | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<CompanyWithPrimaryContact | null>(null);
  const [deleteOne, { isPending: isDeleting }] = useDelete();
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
        basePlaceholder="Search companies by name, email, or website"
        total={total}
        itemSingular="company"
        itemPlural="companies"
      />
      <ModuleToolbarActions>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNewCompany}
          aria-label="New company"
        >
          <Plus className="size-4" />
          New company
        </Button>
      </ModuleToolbarActions>
    </ModuleToolbar>
  ) : null;

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

  if (isPending) return toolbar;
  if (!data?.length && !hasFilters) {
    return (
      <div className="space-y-3">
        {toolbar}
        <CompanyEmpty />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      <DataTable
        rowClick={(_id, _resource, record) => getClientShowPath(record.id)}
        rowClassName={() => "[&_td]:py-1.5 [&_td]:leading-normal"}
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
          render={(record: CompanyWithPrimaryContact) => (
            <CrmPhoneLink
              phone={resolveCompanyPhoneRaw(record)}
              contactId={record.primary_contact_id}
              className="link-action"
            />
          )}
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
    </div>
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
