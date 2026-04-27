import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDataProvider, useNotify, type Identifier } from "ra-core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, PowerOff, Power, Save, X, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { OrganizationForPlatform, OrganizationMember } from "@/components/atomic-crm/types";

const BILLING_STATUSES = [
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
] as const;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
};

const formatQueryError = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e ?? "Error desconocido");
};

// ── Contact edit form (left panel) ───────────────────────────────────────────

type ContactEditState = {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
};

const toContactEditState = (org: OrganizationForPlatform): ContactEditState => ({
  name: org.name ?? "",
  email: org.email ?? "",
  phone: org.phone ?? "",
  website: org.website ?? "",
  address: org.address ?? "",
});

// ── Billing edit form (right panel) ──────────────────────────────────────────

type BillingEditState = {
  billing_status: string;
  billable_seat_count: string;
  price_per_seat_usd_monthly: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_seat_price_id: string;
};

const toBillingEditState = (org: OrganizationForPlatform): BillingEditState => ({
  billing_status: org.billing_status ?? "none",
  billable_seat_count: String(org.billable_seat_count ?? ""),
  price_per_seat_usd_monthly: String(org.price_per_seat_usd_monthly ?? ""),
  stripe_customer_id: org.stripe_customer_id ?? "",
  stripe_subscription_id: org.stripe_subscription_id ?? "",
  stripe_seat_price_id: org.stripe_seat_price_id ?? "",
});

// ── Summary panel (left) ─────────────────────────────────────────────────────

const OrgSummaryPanel = ({
  org,
  onUpdated,
  onDeleted,
}: {
  org: OrganizationForPlatform;
  onUpdated: () => void;
  onDeleted: () => void;
}) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ContactEditState>(toContactEditState(org));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDisabled = Boolean(org.disabled_at);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<OrganizationForPlatform> = {
        name: form.name.trim() || org.name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
      };
      const r = await dataProvider.update("organizations", {
        id: org.id,
        data: payload,
        previousData: org,
      });
      return r.data as OrganizationForPlatform;
    },
    onSuccess: () => {
      notify("Empresa actualizada.", { type: "success" });
      setEditing(false);
      onUpdated();
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const toggleDisableMutation = useMutation({
    mutationFn: async () => {
      const r = await dataProvider.update("organizations", {
        id: org.id,
        data: { disabled_at: isDisabled ? null : new Date().toISOString() },
        previousData: org,
      });
      return r.data as OrganizationForPlatform;
    },
    onSuccess: () => {
      notify(isDisabled ? "Empresa reactivada." : "Empresa desactivada.", { type: "success" });
      onUpdated();
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await dataProvider.delete("organizations", { id: org.id, previousData: org });
    },
    onSuccess: () => {
      notify("Empresa eliminada.", { type: "success" });
      onDeleted();
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center gap-1.5">
        {!editing ? (
          <Button
            size="icon"
            variant="outline"
            title="Editar"
            onClick={() => { setForm(toContactEditState(org)); setEditing(true); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              size="icon"
              title="Guardar"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          size="icon"
          variant="outline"
          title={isDisabled ? "Reactivar" : "Desactivar"}
          onClick={() => toggleDisableMutation.mutate()}
          disabled={toggleDisableMutation.isPending}
        >
          {isDisabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="destructive"
          title="Eliminar"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isDisabled && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Empresa desactivada desde {formatDate(org.disabled_at)}
        </div>
      )}

      <Separator />

      {/* Contact info */}
      {editing ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="empresa@ejemplo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+52 55 0000 0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Página web</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Calle, Ciudad, País"
            />
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Nombre</dt>
            <dd className="font-medium">{org.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Correo electrónico</dt>
            <dd>{org.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Teléfono</dt>
            <dd>{org.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Página web</dt>
            <dd>
              {org.website ? (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline break-all"
                >
                  {org.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Dirección</dt>
            <dd>{org.address || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Registrada</dt>
            <dd className="text-muted-foreground">{formatDate(org.created_at)}</dd>
          </div>
        </dl>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar empresa?</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminará la organización{" "}
              <strong>{org.name}</strong> y todos sus datos relacionados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setConfirmDelete(false); deleteMutation.mutate(); }}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Billing badge ────────────────────────────────────────────────────────────

const BillingBadge = ({ status }: { status?: string | null }) => {
  if (!status || status === "none") return <span className="text-muted-foreground">—</span>;
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    unpaid: "destructive",
    canceled: "outline",
    incomplete: "outline",
    incomplete_expired: "outline",
    paused: "outline",
  };
  return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
};

// ── Billing tab ──────────────────────────────────────────────────────────────

const BillingTab = ({
  org,
  onUpdated,
}: {
  org: OrganizationForPlatform;
  onUpdated: () => void;
}) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BillingEditState>(toBillingEditState(org));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<OrganizationForPlatform> = {
        billing_status: form.billing_status || null,
        billable_seat_count: form.billable_seat_count ? Number(form.billable_seat_count) : null,
        price_per_seat_usd_monthly: form.price_per_seat_usd_monthly
          ? Number(form.price_per_seat_usd_monthly)
          : null,
        stripe_customer_id: form.stripe_customer_id.trim() || null,
        stripe_subscription_id: form.stripe_subscription_id.trim() || null,
        stripe_seat_price_id: form.stripe_seat_price_id.trim() || null,
      };
      const r = await dataProvider.update("organizations", {
        id: org.id,
        data: payload,
        previousData: org,
      });
      return r.data as OrganizationForPlatform;
    },
    onSuccess: () => {
      notify("Facturación actualizada.", { type: "success" });
      setEditing(false);
      onUpdated();
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  return (
    <div className="space-y-4">
      {/* Edit toggle */}
      <div className="flex items-center gap-1.5">
        {!editing ? (
          <Button
            size="icon"
            variant="outline"
            title="Editar facturación"
            onClick={() => { setForm(toBillingEditState(org)); setEditing(true); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              size="icon"
              title="Guardar"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Estado de facturación</Label>
            <Select
              value={form.billing_status}
              onValueChange={(v) => setForm((f) => ({ ...f, billing_status: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asientos facturables</Label>
              <Input
                type="number"
                min={0}
                value={form.billable_seat_count}
                onChange={(e) => setForm((f) => ({ ...f, billable_seat_count: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Precio / asiento (USD/mes)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.price_per_seat_usd_monthly}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price_per_seat_usd_monthly: e.target.value }))
                }
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Stripe Customer ID</Label>
            <Input
              value={form.stripe_customer_id}
              onChange={(e) => setForm((f) => ({ ...f, stripe_customer_id: e.target.value }))}
              placeholder="cus_…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stripe Subscription ID</Label>
            <Input
              value={form.stripe_subscription_id}
              onChange={(e) => setForm((f) => ({ ...f, stripe_subscription_id: e.target.value }))}
              placeholder="sub_…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stripe Price ID</Label>
            <Input
              value={form.stripe_seat_price_id}
              onChange={(e) => setForm((f) => ({ ...f, stripe_seat_price_id: e.target.value }))}
              placeholder="price_…"
            />
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Estado</dt>
            <dd><BillingBadge status={org.billing_status} /></dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Asientos facturables</dt>
              <dd>{org.billable_seat_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Precio / asiento</dt>
              <dd>
                {org.price_per_seat_usd_monthly != null
                  ? `$${org.price_per_seat_usd_monthly} USD/mes`
                  : "—"}
              </dd>
            </div>
          </div>
          <Separator />
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Stripe Customer ID</dt>
            <dd className="font-mono text-xs break-all">{org.stripe_customer_id || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Stripe Subscription ID</dt>
            <dd className="font-mono text-xs break-all">{org.stripe_subscription_id || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-0.5">Stripe Price ID</dt>
            <dd className="font-mono text-xs break-all">{org.stripe_seat_price_id || "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
};

// ── Members tab ──────────────────────────────────────────────────────────────

const MembersTab = ({ orgId }: { orgId: Identifier }) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["platform", "organization_members", orgId],
    queryFn: async () => {
      const r = await dataProvider.getList("organization_members", {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "first_name", order: "ASC" },
        filter: { "org_id@eq": orgId },
      });
      return r as { data: OrganizationMember[]; total: number };
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => notify("Correo de restablecimiento enviado.", { type: "success" }),
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const toggleMemberMutation = useMutation({
    mutationFn: async (member: OrganizationMember) => {
      const r = await dataProvider.update("organization_members", {
        id: member.id,
        data: { disabled: !member.disabled },
        previousData: member,
      });
      return r.data;
    },
    onSuccess: () => {
      notify("Usuario actualizado.", { type: "success" });
      void queryClient.invalidateQueries({
        queryKey: ["platform", "organization_members", orgId],
      });
    },
    onError: (e) => notify(formatQueryError(e), { type: "error" }),
  });

  const members = membersQuery.data?.data ?? [];

  if (membersQuery.isLoading)
    return <p className="text-sm text-muted-foreground py-4">Cargando usuarios…</p>;

  if (membersQuery.isError)
    return (
      <p className="text-sm text-destructive py-4">{formatQueryError(membersQuery.error)}</p>
    );

  if (members.length === 0)
    return <p className="text-sm text-muted-foreground py-4">Sin usuarios registrados.</p>;

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-24">Rol</TableHead>
            <TableHead className="w-20">Estado</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={String(m.id)}>
              <TableCell className="font-medium">
                {m.first_name} {m.last_name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
              <TableCell>
                {m.administrator ? (
                  <Badge variant="secondary">Admin</Badge>
                ) : (
                  <Badge variant="outline">Usuario</Badge>
                )}
              </TableCell>
              <TableCell>
                {m.disabled ? (
                  <Badge variant="destructive">Inactivo</Badge>
                ) : (
                  <Badge variant="default">Activo</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Restablecer contraseña"
                    onClick={() => resetPasswordMutation.mutate(m.email)}
                    disabled={resetPasswordMutation.isPending}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={m.disabled ? "Activar" : "Desactivar"}
                    onClick={() => toggleMemberMutation.mutate(m)}
                    disabled={toggleMemberMutation.isPending}
                  >
                    {m.disabled ? (
                      <Power className="h-3.5 w-3.5" />
                    ) : (
                      <PowerOff className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

export const PlatformEmpresaDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dataProvider = useDataProvider() as CrmDataProvider;
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ["platform", "organizations", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const r = await dataProvider.getOne("organizations", { id: id! });
      return r.data as OrganizationForPlatform;
    },
  });

  const org = orgQuery.data ?? null;

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
  };

  const handleDeleted = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    navigate("/sas/empresas", { replace: true });
  };

  if (orgQuery.isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cargando empresa…</p>
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">
          No se pudo cargar la empresa: {formatQueryError(orgQuery.error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/sas/empresas")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sas/empresas")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Empresas
        </Button>
        <h1 className="text-xl font-semibold tracking-tight truncate">{org.name}</h1>
        <span className="text-xs text-muted-foreground font-mono ml-1">#{String(id)}</span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Left: contact summary + actions */}
        <div className="rounded-lg border bg-card p-5">
          <OrgSummaryPanel org={org} onUpdated={handleUpdated} onDeleted={handleDeleted} />
        </div>

        {/* Right: tabs */}
        <div className="rounded-lg border bg-card p-5">
          <Tabs defaultValue="usuarios">
            <TabsList>
              <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
              <TabsTrigger value="facturacion">Facturación</TabsTrigger>
            </TabsList>

            <TabsContent value="usuarios" className="mt-4">
              <MembersTab orgId={org.id} />
            </TabsContent>

            <TabsContent value="facturacion" className="mt-4">
              <BillingTab org={org} onUpdated={handleUpdated} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
