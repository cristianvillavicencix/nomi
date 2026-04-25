import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform (SaaS)</h1>
        <p className="text-muted-foreground text-sm">
          Workspaces (organizations), Stripe links, and seat pricing. Model:{" "}
          <strong>${DEFAULT_SEAT_USD_PER_MONTH}/user/month</strong> by default; default Stripe price
          id <code className="text-xs">{resolveSeatPriceId()}</code>.
        </p>
        <p className="text-muted-foreground text-xs font-mono mt-2">
          Datos de esta consola: proyecto Supabase <span className="text-foreground">{supabaseProjectHost}</span>{" "}
          (VITE_SUPABASE_URL). Si aquí no ves a los usuarios que ves en el CRM, casi seguro el CRM usa otro
          proyecto o entorno.
        </p>
      </div>

      <Tabs defaultValue="orgs">
        <TabsList>
          <TabsTrigger value="orgs">Organizations &amp; billing</TabsTrigger>
          <TabsTrigger value="auth">Auth accounts</TabsTrigger>
          <TabsTrigger value="users">CRM members (sales)</TabsTrigger>
        </TabsList>
        <TabsContent value="orgs" className="mt-4">
          <OrganizationsPanel
            query={orgsQuery}
            dataProvider={dataProvider}
            notify={notify}
          />
        </TabsContent>
        <TabsContent value="auth" className="mt-4">
          <AuthAccountsPanel query={authUsersQuery} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <SalesPanel query={salesQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const OrganizationsPanel = ({
  query,
  dataProvider,
  notify,
}: {
  query: ReturnType<typeof useQuery<{ data: OrganizationForPlatform[]; total: number }>>;
  dataProvider: CrmDataProvider;
  notify: ReturnType<typeof useNotify>;
}) => {
  const rows = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
        <CardDescription>
          Each row is a tenant workspace. Assign Stripe customer / subscription ids and seat counts
          here; checkout and webhooks can keep these in sync later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {query.isError ? (
          <p className="text-sm text-destructive">Could not load organizations.</p>
        ) : null}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="min-w-[120px]">$/seat/mo</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Stripe customer</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Price id</TableHead>
                <TableHead className="min-w-[200px]">Stripe</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <OrgEditRow
                  key={row.id}
                  org={row}
                  dataProvider={dataProvider}
                  onSaved={() => {
                    void query.refetch();
                    notify("Organization updated", { type: "success" });
                  }}
                  onError={() => notify("Update failed", { type: "error" })}
                  onStripeEvent={() => void query.refetch()}
                  notify={notify}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
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
    <div className="flex flex-col gap-1.5">
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

const OrgEditRow = ({
  org,
  dataProvider,
  onSaved,
  onError,
  onStripeEvent,
  notify,
}: {
  org: OrganizationForPlatform;
  dataProvider: CrmDataProvider;
  onSaved: () => void;
  onError: () => void;
  onStripeEvent: () => void;
  notify: ReturnType<typeof useNotify>;
}) => {
  const [price, setPrice] = useState(String(org.price_per_seat_usd_monthly ?? DEFAULT_SEAT_USD_PER_MONTH));
  const [seats, setSeats] = useState(
    org.billable_seat_count != null ? String(org.billable_seat_count) : "",
  );
  const [billing, setBilling] = useState(org.billing_status ?? "none");
  const [cust, setCust] = useState(org.stripe_customer_id ?? "");
  const [sub, setSub] = useState(org.stripe_subscription_id ?? "");
  const [priceId, setPriceId] = useState(org.stripe_seat_price_id ?? resolveSeatPriceId());
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      const seatsNum = seats === "" ? null : Number.parseInt(seats, 10);
      if (seats !== "" && (seatsNum === undefined || Number.isNaN(seatsNum) || seatsNum < 0)) {
        throw new Error("Invalid seats");
      }
      const priceNum = Number.parseFloat(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        throw new Error("Invalid price");
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
      onSaved();
    } catch {
      onError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{org.id}</TableCell>
      <TableCell className="max-w-[180px] truncate" title={org.name}>
        {org.name}
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-24"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-20"
          placeholder="—"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          inputMode="numeric"
        />
      </TableCell>
      <TableCell>
        <Select value={billing} onValueChange={setBilling}>
          <SelectTrigger className="h-8 w-[160px]">
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
      </TableCell>
      <TableCell>
        <Input className="h-8 min-w-[140px] font-mono text-xs" value={cust} onChange={(e) => setCust(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-8 min-w-[140px] font-mono text-xs" value={sub} onChange={(e) => setSub(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-8 min-w-[200px] font-mono text-xs" value={priceId} onChange={(e) => setPriceId(e.target.value)} />
      </TableCell>
      <TableCell className="align-top">
        <OrgStripeActions
          org={org}
          dataProvider={dataProvider}
          notify={notify}
          onAfter={onStripeEvent}
        />
      </TableCell>
      <TableCell className="w-[88px]">
        <Button type="button" size="sm" disabled={saving} onClick={() => void onSave()}>
          {saving ? "…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
};

const formatPlatformDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const AuthAccountsPanel = ({
  query,
}: {
  query: ReturnType<
    typeof useQuery<{
      users: Array<{
        id: string;
        email: string | null;
        created_at: string;
        last_sign_in_at: string | null;
        email_confirmed_at: string | null;
      }>;
      total: number;
    }>
  >;
}) => {
  const users = query.data?.users ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth accounts</CardTitle>
        <CardDescription>
          Todas las cuentas creadas en <strong>Supabase Auth</strong> (registro, invitación, etc.).
          Incluye quien aún no tenga ficha en el CRM. La pestaña <strong>CRM members</strong> es la tabla{" "}
          <code>sales</code> (miembros por organización).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
        {query.isError ? (
          <p className="text-sm text-destructive">
            No se pudo cargar. Si usas el proyecto en local, arranca la función:{" "}
            <code className="text-xs">npx supabase functions serve</code> (o despliega en la nube).
          </p>
        ) : null}
        <div className="mb-2 text-xs text-muted-foreground">Total: {query.data?.total ?? users.length}</div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>User id</TableHead>
                <TableHead>Alta (Auth)</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Email confirmado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-[240px] truncate" title={u.email ?? ""}>
                    {u.email ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate" title={u.id}>
                    {u.id}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatPlatformDate(u.created_at)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatPlatformDate(u.last_sign_in_at)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatPlatformDate(u.email_confirmed_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const SalesPanel = ({
  query,
}: {
  query: ReturnType<typeof useQuery<{ data: Sale[]; total: number }>>;
}) => {
  const rows = query.data?.data ?? [];
  const byOrg = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of rows) {
      const k = String(s.org_id ?? "");
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>CRM members (sales)</CardTitle>
        <CardDescription>
          Usuarios con ficha de equipo en el CRM: tabla <code>sales</code> (nombre, org, roles). Cada
          login suele tener una fila aquí, además de su cuenta en Auth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {query.isError ? (
          <p className="text-sm text-destructive">Could not load users.</p>
        ) : null}
        <div className="mb-2 text-xs text-muted-foreground">
          Distinct orgs: {byOrg.size} · Total user rows: {rows.length}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>org_id</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="font-mono text-xs">{s.org_id}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={s.email}>
                    {s.email}
                  </TableCell>
                  <TableCell>
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell>{s.administrator ? "yes" : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
