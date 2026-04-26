import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useNotify, type Identifier } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePlatformOperator } from "./usePlatformOperator";
import { DEFAULT_SEAT_USD_PER_MONTH, resolveSeatPriceId } from "./billingDefaults";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { OrganizationForPlatform, Sale } from "@/components/atomic-crm/types";

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

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

const formatPlatformDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const OrgStripeActions = ({
  org,
  dataProvider,
  notify,
  onAfter,
}: {
  org: OrganizationForPlatform;
  dataProvider: CrmDataProvider;
  notify: ReturnType<typeof useNotify>;
  onAfter: () => void;
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const orgId = Number(org.id);
  const hasCustomer = Boolean(org.stripe_customer_id?.trim());
  const blockNewCheckout =
    Boolean(org.stripe_subscription_id) &&
    ["active", "trialing", "past_due", "incomplete", "unpaid", "paused"].includes(
      org.billing_status ?? "",
    );

  return (
    <div className="flex flex-row flex-wrap gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 text-xs"
        disabled={busy !== null || blockNewCheckout}
        onClick={() => {
          void (async () => {
            setBusy("checkout");
            try {
              await dataProvider.stripeCreateCheckoutSession({
                orgId,
                returnPath: "/platform",
              });
            } catch (e) {
              notify((e as Error).message, { type: "error" });
            } finally {
              setBusy(null);
            }
          })();
        }}
      >
        {busy === "checkout" ? "…" : "Subscribe"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 text-xs"
        disabled={busy !== null || !hasCustomer}
        onClick={() => {
          void (async () => {
            setBusy("portal");
            try {
              await dataProvider.stripeBillingPortal({ orgId, returnPath: "/platform" });
            } catch (e) {
              notify((e as Error).message, { type: "error" });
            } finally {
              setBusy(null);
            }
          })();
        }}
      >
        {busy === "portal" ? "…" : "Portal"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={busy !== null || !org.stripe_subscription_id}
        onClick={() => {
          void (async () => {
            setBusy("sync");
            try {
              const r = await dataProvider.stripeSyncSeats({ orgId });
              notify(
                r?.skipped
                  ? "Seat count already matches Stripe."
                  : `Synced — quantity ${r?.quantity ?? "?"}.`,
                { type: "success" },
              );
              onAfter();
            } catch (e) {
              notify((e as Error).message, { type: "error" });
            } finally {
              setBusy(null);
            }
          })();
        }}
      >
        {busy === "sync" ? "…" : "Sync seats"}
      </Button>
    </div>
  );
};

const OrganizationAccountDialog = ({
  org,
  open,
  onOpenChange,
  allSales,
  authUsers,
  authLoading,
  salesLoading,
  dataProvider,
  notify,
  onOrgUpdated,
  onMemberClick,
}: {
  org: OrganizationForPlatform | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSales: Sale[];
  authUsers: AuthUserRow[];
  authLoading: boolean;
  salesLoading: boolean;
  dataProvider: CrmDataProvider;
  notify: ReturnType<typeof useNotify>;
  onOrgUpdated: () => void;
  onMemberClick: (sale: Sale) => void;
}) => {
  const orgId = org != null ? Number(org.id) : NaN;
  const members = useMemo(() => {
    if (org == null || Number.isNaN(orgId)) return [];
    return allSales.filter((s) => Number(s.org_id) === orgId);
  }, [allSales, org, orgId]);

  const authById = useMemo(() => {
    const m = new Map<string, AuthUserRow>();
    for (const u of authUsers) m.set(u.id, u);
    return m;
  }, [authUsers]);

  const [price, setPrice] = useState(
    String(org?.price_per_seat_usd_monthly ?? DEFAULT_SEAT_USD_PER_MONTH),
  );
  const [seats, setSeats] = useState(
    org?.billable_seat_count != null ? String(org.billable_seat_count) : "",
  );
  const [billing, setBilling] = useState(org?.billing_status ?? "none");
  const [cust, setCust] = useState(org?.stripe_customer_id ?? "");
  const [sub, setSub] = useState(org?.stripe_subscription_id ?? "");
  const [priceId, setPriceId] = useState(org?.stripe_seat_price_id ?? resolveSeatPriceId());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org) return;
    setPrice(String(org.price_per_seat_usd_monthly ?? DEFAULT_SEAT_USD_PER_MONTH));
    setSeats(org.billable_seat_count != null ? String(org.billable_seat_count) : "");
    setBilling(org.billing_status ?? "none");
    setCust(org.stripe_customer_id ?? "");
    setSub(org.stripe_subscription_id ?? "");
    setPriceId(org.stripe_seat_price_id ?? resolveSeatPriceId());
  }, [org]);

  const billable = org?.billable_seat_count ?? null;
  const headcount = members.length;
  const seatMismatch =
    billable != null && billable !== headcount ? (billable > headcount ? "under" as const : "over" as const) : null;

  const onSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      const seatsNum = seats === "" ? null : Number.parseInt(seats, 10);
      if (seats !== "" && (seatsNum === undefined || Number.isNaN(seatsNum) || seatsNum < 0)) {
        throw new Error("Asientos no válidos");
      }
      const priceNum = Number.parseFloat(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        throw new Error("Precio no válido");
      }
      await dataProvider.update("organizations", {
        id: org.id,
        data: {
          price_per_seat_usd_monthly: priceNum,
          billable_seat_count: seatsNum,
          billing_status: billing,
          stripe_customer_id: cust || null,
          stripe_subscription_id: sub || null,
          stripe_seat_price_id: priceId || null,
        },
        previousData: org,
      });
      onOrgUpdated();
      notify("Organización actualizada", { type: "success" });
    } catch {
      notify("No se pudo guardar", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!org) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{org.name}</DialogTitle>
          <DialogDescription>
            Espacio de trabajo (tenant) · ID <span className="font-mono">{String(org.id)}</span>
            {org.created_at ? (
              <>
                {" "}
                · creada {formatPlatformDate(org.created_at)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <h4 className="text-foreground font-medium mb-2">Facturación y Stripe</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-muted-foreground text-xs">$/asiento/mes</label>
                <Input
                  className="h-9 mt-0.5"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs">Asientos facturables</label>
                <Input
                  className="h-9 mt-0.5"
                  placeholder="—"
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs">Estado de facturación</label>
                <Select value={billing} onValueChange={setBilling}>
                  <SelectTrigger className="h-9 mt-0.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground text-xs">Stripe customer id</label>
                <Input
                  className="h-9 mt-0.5 font-mono text-xs"
                  value={cust}
                  onChange={(e) => setCust(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground text-xs">Subscription id</label>
                <Input
                  className="h-9 mt-0.5 font-mono text-xs"
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground text-xs">Price id (Stripe)</label>
                <Input
                  className="h-9 mt-0.5 font-mono text-xs"
                  value={priceId}
                  onChange={(e) => setPriceId(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={saving} onClick={() => void onSave()}>
                {saving ? "…" : "Guardar cambios"}
              </Button>
              <OrgStripeActions
                org={org}
                dataProvider={dataProvider}
                notify={notify}
                onAfter={() => {
                  onOrgUpdated();
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs mt-2">
              Tras añadir o quitar miembros, usa <strong>Sync seats</strong> para alinear con Stripe.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="text-foreground font-medium mb-1">Usuarios de esta empresa</h4>
            {salesLoading ? (
              <p className="text-muted-foreground text-xs">Cargando miembros…</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span>
                  Fichas: <strong>{headcount}</strong>
                </span>
                {billable != null ? (
                  <span className="text-muted-foreground">
                    · Asientos declarados: <strong>{billable}</strong>
                  </span>
                ) : null}
                {seatMismatch === "under" ? <Badge variant="secondary">Más asientos en Stripe que fichas</Badge> : null}
                {seatMismatch === "over" ? <Badge variant="outline">Más fichas que asientos</Badge> : null}
                {!seatMismatch && billable != null && billable === headcount ? (
                  <Badge variant="default" className="font-normal">
                    Asientos = miembros
                  </Badge>
                ) : null}
              </div>
            )}

            <div className="rounded-md border overflow-x-auto max-h-[min(50vh,320px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="min-w-[120px]">Últ. acceso (Auth)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center text-xs">
                        Ningún usuario en esta organización aún. Haz clic en un usuario (cuando exista) para ver su
                        detalle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => {
                      const au = m.user_id ? authById.get(m.user_id) : undefined;
                      return (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onMemberClick(m)}
                        >
                          <TableCell>
                            {m.first_name} {m.last_name}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs" title={m.email}>
                            {m.email}
                          </TableCell>
                          <TableCell>{m.administrator ? "sí" : ""}</TableCell>
                          <TableCell>{m.disabled ? "Desactivado" : "Activo"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {authLoading && !au ? "…" : au ? formatPlatformDate(au.last_sign_in_at) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-xs mt-2">Haz clic en una fila para ver el detalle de esa persona.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UserDetailDialog = ({
  open,
  onOpenChange,
  sale,
  orgName,
  auth,
  authLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  orgName: string;
  auth: AuthUserRow | undefined;
  authLoading: boolean;
}) => {
  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sale.first_name} {sale.last_name}
          </DialogTitle>
          <DialogDescription>
            Usuario del CRM (tabla <code>sales</code>) · {orgName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right break-all">{sale.email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Empresa (org_id)</dt>
              <dd className="font-mono text-xs">{String(sale.org_id ?? "—")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Admin CRM</dt>
              <dd>{sale.administrator ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ficha</dt>
              <dd>{sale.disabled ? "Desactivada" : "Activa"}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">ID ficha (sales)</dt>
              <dd className="font-mono text-xs break-all">{String(sale.id)}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">User id (Auth)</dt>
              <dd className="font-mono text-xs break-all">{sale.user_id || "—"}</dd>
            </div>
          </dl>
          <Separator />
          <h4 className="font-medium text-foreground">Cuenta de acceso (Auth)</h4>
          {authLoading ? (
            <p className="text-muted-foreground text-xs">Cargando…</p>
          ) : auth ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Alta en Auth</dt>
                <dd className="text-xs whitespace-nowrap">{formatPlatformDate(auth.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Último acceso</dt>
                <dd className="text-xs whitespace-nowrap">{formatPlatformDate(auth.last_sign_in_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Email confirmado</dt>
                <dd className="text-xs whitespace-nowrap">{formatPlatformDate(auth.email_confirmed_at)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-xs">Sin datos de Auth para este id (revisa que exista en Supabase Auth).</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const supabaseProjectHost = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).host;
  } catch {
    return "—";
  }
})();

export const PlatformPage = () => {
  const { data: gate, isPending: gatePending, isError: gateError } = usePlatformOperator();
  const notify = useNotify();
  const dataProvider = useDataProvider() as CrmDataProvider;
  const [searchParams, setSearchParams] = useSearchParams();

  const orgsQuery = useQuery({
    queryKey: ["platform", "organizations"],
    queryFn: async () => {
      const r = await dataProvider.getList("organizations", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      });
      return r;
    },
    enabled: gate?.isPlatformOperator === true,
  });

  useEffect(() => {
    const c = searchParams.get("checkout");
    if (c === "success") {
      notify("Checkout completed. Webhooks will update the subscription in your database.", {
        type: "success",
      });
      void orgsQuery.refetch();
    } else if (c === "cancel") {
      notify("Checkout was canceled.", { type: "info" });
    }
    if (c) {
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      next.delete("org_id");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, notify, orgsQuery]);

  const salesQuery = useQuery({
    queryKey: ["platform", "sales"],
    queryFn: async () => {
      const r = await dataProvider.getList("sales", {
        pagination: { page: 1, perPage: 2000 },
        sort: { field: "org_id", order: "ASC" },
      });
      return r;
    },
    enabled: gate?.isPlatformOperator === true,
  });

  const authUsersQuery = useQuery({
    queryKey: ["platform", "auth_users"],
    queryFn: () => dataProvider.getPlatformAuthUsers(),
    enabled: gate?.isPlatformOperator === true,
  });

  if (gatePending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Platform</CardTitle>
          <CardDescription>Checking access…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (gateError || !gate?.isPlatformOperator) {
    return <Navigate to="/" replace />;
  }

  const orgs = orgsQuery.data?.data ?? [];
  const sales = salesQuery.data?.data ?? [];
  const authList = authUsersQuery.data?.users ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plataforma (SaaS)</h1>
        <p className="text-muted-foreground text-sm">
          <strong>Empresas registradas</strong> abajo. Haz clic en una fila para abrir su ficha: usuarios
          de esa empresa, facturación y Stripe. Modelo: <strong>${DEFAULT_SEAT_USD_PER_MONTH}/usuario/mes</strong>;{" "}
          <code className="text-xs">{resolveSeatPriceId()}</code>.
        </p>
        <p className="text-muted-foreground text-xs font-mono mt-2">
          Proyecto: <span className="text-foreground">{supabaseProjectHost}</span> (VITE_SUPABASE_URL).
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {orgsQuery.isLoading ? "…" : <><strong className="text-foreground tabular-nums">{orgs.length}</strong> empresas en total</>}
        </p>
      </div>

      <OrganizationsPanel
        query={orgsQuery}
        dataProvider={dataProvider}
        notify={notify}
        sales={sales}
        authUsers={authList}
        authLoading={authUsersQuery.isLoading}
        salesLoading={salesQuery.isLoading}
      />
    </div>
  );
};

const OrganizationsPanel = ({
  query,
  dataProvider,
  notify,
  sales,
  authUsers,
  authLoading,
  salesLoading,
}: {
  query: ReturnType<typeof useQuery<{ data: OrganizationForPlatform[]; total: number }>>;
  dataProvider: CrmDataProvider;
  notify: ReturnType<typeof useNotify>;
  sales: Sale[];
  authUsers: AuthUserRow[];
  authLoading: boolean;
  salesLoading: boolean;
}) => {
  const rows = query.data?.data ?? [];
  const [openOrgId, setOpenOrgId] = useState<Identifier | null>(null);
  const [userDetail, setUserDetail] = useState<Sale | null>(null);

  const openOrg = useMemo(
    () => (openOrgId != null ? rows.find((r) => r.id === openOrgId) ?? null : null),
    [rows, openOrgId],
  );

  const countByOrg = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of sales) {
      const k = Number(s.org_id);
      if (Number.isFinite(k)) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [sales]);

  const orgNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of rows) m.set(Number(o.id), o.name);
    return m;
  }, [rows]);

  const authById = useMemo(() => {
    const m = new Map<string, AuthUserRow>();
    for (const u of authUsers) m.set(u.id, u);
    return m;
  }, [authUsers]);

  return (
    <>
      <UserDetailDialog
        open={userDetail != null}
        onOpenChange={(o) => {
          if (!o) setUserDetail(null);
        }}
        sale={userDetail}
        orgName={userDetail ? orgNameById.get(Number(userDetail.org_id)) ?? "—" : "—"}
        auth={userDetail && userDetail.user_id ? authById.get(userDetail.user_id) : undefined}
        authLoading={authLoading}
      />
      <OrganizationAccountDialog
        org={openOrg}
        open={openOrgId != null}
        onOpenChange={(o) => {
          if (!o) setOpenOrgId(null);
        }}
        allSales={sales}
        authUsers={authUsers}
        authLoading={authLoading}
        salesLoading={salesLoading}
        dataProvider={dataProvider}
        notify={notify}
        onOrgUpdated={() => void query.refetch()}
        onMemberClick={(m) => setUserDetail(m)}
      />
      <Card>
        <CardHeader>
          <CardTitle>Empresas registradas</CardTitle>
          <CardDescription>
            Una sola lista. Clic en la fila para abrir: usuarios bajo esa empresa, precios, Stripe y
            sincronización de asientos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
          {query.isError ? (
            <p className="text-sm text-destructive">No se pudieron cargar las organizaciones.</p>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-24">Usuarios</TableHead>
                  <TableHead>Facturación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const oid = Number(row.id);
                  const n = countByOrg.get(oid) ?? 0;
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setOpenOrgId(row.id)}
                    >
                      <TableCell className="font-medium max-w-[220px] truncate" title={row.name}>
                        {row.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                      <TableCell className="tabular-nums">{n}</TableCell>
                      <TableCell className="text-sm">{row.billing_status ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && !query.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No hay empresas todavía.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
