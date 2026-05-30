import { useState } from "react";
import { ChevronLeft, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  RecordContextProvider,
  useDelete,
  useNotify,
} from "ra-core";
import { Button } from "@/components/ui/button";
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
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import { getClientEditPath, getClientsListPath } from "@/lbs/routing";

type ClientShowActionsProps = {
  record: CompanyWithPrimaryContact;
};

export const ClientShowActions = ({ record }: ClientShowActionsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteOne, { isPending: isDeleting }] = useDelete();

  const listPath = location.state?.from ?? getClientsListPath();

  const handleDelete = () => {
    deleteOne(
      "companies",
      { id: record.id, previousData: record },
      {
        onSuccess: () => {
          notify("Empresa eliminada", { type: "info" });
          setDeleteOpen(false);
          navigate(getClientsListPath());
        },
        onError: () => {
          notify("No se pudo eliminar la empresa", { type: "error" });
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
          <span className="text-sm font-semibold">Empresas</span>
        </Button>
      </PageActions>

      <PageActionsTrailing>
        <RecordContextProvider value={record}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={getClientEditPath(record.id)}>
                  <Pencil className="size-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash className="size-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RecordContextProvider>
      </PageActionsTrailing>

      <Confirm
        isOpen={deleteOpen}
        title="¿Eliminar esta empresa?"
        content="Se elimina el registro de la empresa. Los contactos y proyectos vinculados pueden permanecer en el sistema."
        confirm="Eliminar"
        confirmColor="warning"
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={isDeleting}
      />
    </>
  );
};
