import { useDataProvider } from "ra-core";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { PowerOff, Power, Trash2 } from "lucide-react";
import { useNotify } from "ra-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { OrganizationForPlatform } from "@/components/atomic-crm/types";

export const displayOrgName = (record: { id: unknown; name?: string | null }): string => {
  const n = record.name?.trim() ?? "";
  if (n.length > 0) return n;
  return `Organización (id ${String(record.id)})`;
};

const formatQueryError = (e: unknown): string => {
  if (e == null) return "";
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
};

export const PlatformEmpresasPage = () => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const orgsQuery = useQuery({
    queryKey: ["platform", "organizations"],
    queryFn: async () => {
      const r = await dataProvider.getList("organizations", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });
      return r as { data: OrganizationForPlatform[]; total: number };
    },
  });

  // Fetch member counts per org
  const membersQuery = useQuery({
    queryKey: ["platform", "organization_members", "all-counts"],
    queryFn: async () => {
      const r = await dataProvider.getList("organization_members", {
        pagination: { page: 1, perPage: 5000 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });
      const counts: Record<number, number> = {};
      for (const m of r.data) {
        const orgId = (m as { org_id?: number }).org_id;
        if (orgId != null) counts[orgId] = (counts[orgId] ?? 0) + 1;
      }
      return counts;
    },
  });

  const toggleDisableMutation = useMutation({
    mutationFn: async (org: OrganizationForPlatform) => {
      const r = await dataProvider.update("organizations", {
        id: org.id,
        data: { disabled_at: org.disabled_at ? null : new Date().toISOString() },
        previousData: org,
      });
      return r.data as OrganizationForPlatform;
    },
    onSuccess: () => {
      notify("Empresa actualizada.", { type: "success" });
      void queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const org = rows.find((r) => r.id === id);
      await dataProvider.delete("organizations", { id, previousData: org });
    },
    onSuccess: () => {
      notify("Empresa eliminada.", { type: "success" });
      void queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const rows = orgsQuery.data?.data ?? [];
  const counts = membersQuery.data ?? {};
  const confirmOrg = confirmDeleteId != null ? rows.find((r) => r.id === confirmDeleteId) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-muted-foreground text-sm">
          Organizaciones registradas. Clic en una fila para ver el perfil completo.
        </p>
      </div>

      {orgsQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
      {orgsQuery.isError ? (
        <p className="text-sm text-destructive">
          No se pudo listar organizations: {formatQueryError(orgsQuery.error)}.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">ID</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="w-24 text-center">Usuarios</TableHead>
              <TableHead className="w-28 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={String(row.id)}
                className={`cursor-pointer hover:bg-muted/50${row.disabled_at ? " opacity-50" : ""}`}
                onClick={() => void navigate(`/sas/empresas/${String(row.id)}`)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">{String(row.id)}</TableCell>
                <TableCell className="font-medium max-w-45 truncate" title={displayOrgName(row)}>
                  {displayOrgName(row)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                  {row.email || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.phone || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                  {row.address || "—"}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {counts[row.id as number] ?? 0}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={row.disabled_at ? "Reactivar" : "Desactivar"}
                      onClick={() => toggleDisableMutation.mutate(row)}
                      disabled={toggleDisableMutation.isPending}
                    >
                      {row.disabled_at ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Eliminar"
                      onClick={() => setConfirmDeleteId(row.id as number)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !orgsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No hay empresas todavía.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId != null} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar empresa?</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminará{" "}
              <strong>{confirmOrg ? displayOrgName(confirmOrg) : ""}</strong> y todos sus datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirmDeleteId != null) {
                  deleteMutation.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
