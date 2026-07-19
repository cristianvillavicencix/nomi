import { useState } from "react";
import { ChevronLeft, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { RecordContextProvider, useDelete, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Confirm } from "@/components/admin/confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageActions,
  PageActionsTrailing,
} from "@/components/atomic-crm/layout/PageActions";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";
import { getCompaniesListPath } from "@/app/routing";

type ClientShowActionsProps = {
  record: CompanyWithPrimaryContact;
  onEdit?: () => void;
};

export const ClientShowActions = ({
  record,
  onEdit,
}: ClientShowActionsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteOne, { isPending: isDeleting }] = useDelete();

  const listPath = location.state?.from ?? getCompaniesListPath();

  const handleDelete = () => {
    deleteOne(
      "companies",
      { id: record.id, previousData: record },
      {
        onSuccess: () => {
          notify("Company deleted", { type: "info" });
          setDeleteOpen(false);
          navigate(getCompaniesListPath());
        },
        onError: () => {
          notify("Failed to delete company", { type: "error" });
        },
      },
    );
  };

  return (
    <>
      <PageActions>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 link-action"
          onClick={() => navigate(listPath)}
        >
          <ChevronLeft className="size-4" />
          <span className="text-sm font-semibold">Companies</span>
        </Button>
      </PageActions>

      <PageActionsTrailing>
        <RecordContextProvider value={record}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton className="size-9" aria-label="More options">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.()}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RecordContextProvider>
      </PageActionsTrailing>

      <Confirm
        isOpen={deleteOpen}
        title="Delete this company?"
        content="This removes the company record. Linked contacts and projects may remain in the system."
        confirm="Delete"
        confirmColor="warning"
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={isDeleting}
      />
    </>
  );
};
