import { useState } from "react";
import { useDataProvider, type Identifier } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { OrganizationForPlatform } from "@/components/atomic-crm/types";

const formatPlatformDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

export const displayOrgName = (record: { id: unknown; name?: string | null }): string => {
  const n = record.name?.trim() ?? "";
  if (n.length > 0) return n;
  return `Organización (id ${String(record.id)})`;
};

const formatQueryError = (e: unknown): string => {
  if (e == null) return "";
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
};

const OrgReadOnlyDialog = ({
  org,
  open,
  onOpenChange,
}: {
  org: OrganizationForPlatform | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  if (!org) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{displayOrgName(org)}</DialogTitle>
          <DialogDescription>
            ID <span className="font-mono">{String(org.id)}</span>
            {org.created_at ? <> · creada {formatPlatformDate(org.created_at)}</> : null}
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Estado de facturación</dt>
            <dd>{org.billing_status ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-xs">
          Edición y facturación avanzada no están en esta consola. Solo el listado de empresas.
        </p>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Módulo «Empresas» de la consola de plataforma.
 */
export const PlatformEmpresasPage = () => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const [openId, setOpenId] = useState<Identifier | null>(null);

  const orgsQuery = useQuery({
    queryKey: ["platform", "organizations"],
    queryFn: async () => {
      const r = await dataProvider.getList("organizations", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      });
      return r;
    },
  });

  const rows = orgsQuery.data?.data ?? [];
  const openRow = openId != null ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-muted-foreground text-sm">
          Organizaciones (tenants) registradas. Clic en una fila para el detalle básico.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>Datos de la tabla <code className="text-xs">organizations</code>.</CardDescription>
        </CardHeader>
        <CardContent>
          {orgsQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
          {orgsQuery.isError ? (
            <p className="text-sm text-destructive">
              No se pudo listar `organizations`: {formatQueryError(orgsQuery.error)}. Comprueba migraciones y políticas
              de plataforma.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Facturación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={String(row.id)}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setOpenId(row.id)}
                  >
                    <TableCell className="font-medium max-w-[240px] truncate" title={displayOrgName(row)}>
                      {displayOrgName(row)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{String(row.id)}</TableCell>
                    <TableCell className="text-sm">{row.billing_status ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !orgsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No hay empresas todavía.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <OrgReadOnlyDialog
        org={openRow}
        open={openId != null}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
      />
    </div>
  );
};
