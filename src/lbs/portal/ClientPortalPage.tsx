import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { ClientPortalLayout } from "@/lbs/portal/ClientPortalLayout";
import { ClientWebsiteSection } from "@/lbs/portal/ClientWebsiteSection";
import {
  getPortalCopy,
  PORTAL_LOCALE_KEY,
  type PortalLocale,
} from "@/lbs/portal/portalI18n";
import {
  type PortalPayload,
  type PortalProject,
  type PortalView,
} from "@/lbs/portal/portalTypes";

const PORTAL_TOKEN_KEY = "lbs.client_portal.token";

const fetchPortal = async (token: string, dealId?: number) => {
  const { data, error } = await supabase.functions.invoke("client_portal", {
    body: { token, deal_id: dealId },
  });
  if (error) throw error;
  return data as PortalPayload;
};

const parseView = (value: string | null): PortalView => {
  const allowed: PortalView[] = [
    "general",
    "credentials",
    "corporate_email",
    "domain_dns",
    "files",
    "marketing_seo",
    "training",
    "support",
  ];
  return allowed.includes(value as PortalView) ? (value as PortalView) : "general";
};

export const ClientPortalPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(
    () => searchParams.get("token") ?? localStorage.getItem(PORTAL_TOKEN_KEY) ?? "",
  );
  const [locale, setLocale] = useState<PortalLocale>(() => {
    const stored = localStorage.getItem(PORTAL_LOCALE_KEY);
    return stored === "en" ? "en" : "es";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PortalPayload | null>(null);

  const selectedDealId = Number(searchParams.get("project"));
  const activeView = parseView(searchParams.get("view"));
  const copy = getPortalCopy(locale);

  useEffect(() => {
    if (!token.trim()) return;
    localStorage.setItem(PORTAL_TOKEN_KEY, token.trim());
    setLoading(true);
    setError(null);
    void fetchPortal(
      token.trim(),
      Number.isFinite(selectedDealId) ? selectedDealId : undefined,
    )
      .then(setPayload)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load portal");
      })
      .finally(() => setLoading(false));
  }, [activeView, selectedDealId, token]);

  useEffect(() => {
    if (!token.trim() || !payload) return;
    if (Number.isFinite(selectedDealId)) return;
    // Auto-select first delivered project when a project-specific tab is opened.
    const deliveredProject = (payload.projects ?? []).find((project) => project.delivery);
    if (!deliveredProject) return;
    const next = new URLSearchParams(searchParams);
    next.set("project", String(deliveredProject.id));
    setSearchParams(next, { replace: true });
  }, [activeView, payload, searchParams, selectedDealId, setSearchParams, token]);

  const projects = useMemo(() => {
    if (payload?.project) return [payload.project];
    return payload?.projects ?? [];
  }, [payload]);

  const activeProject = useMemo(() => {
    if (payload?.project) return payload.project;
    if (Number.isFinite(selectedDealId)) {
      return projects.find((project) => project.id === selectedDealId) ?? null;
    }
    return projects[0] ?? null;
  }, [payload?.project, projects, selectedDealId]);

  const delivery = payload?.delivery ?? activeProject?.delivery ?? null;
  const websiteUnlocked = Boolean(delivery);
  const unreadNotifications =
    payload?.notifications?.filter((entry) => !entry.read_at).length ?? 0;

  const setView = (view: PortalView) => {
    const next = new URLSearchParams(searchParams);
    if (view === "dashboard") next.delete("view");
    else next.set("view", view);
    setSearchParams(next, { replace: true });
  };

  const headline = payload?.account?.email
    ? `${copy.welcome}, ${payload.account.email.split("@")[0]}`
    : copy.welcome;

  const renderWebsite = () => {
    if (!activeProject) {
      return <p className="text-sm text-muted-foreground">{copy.selectProject}</p>;
    }
    if (!delivery || !payload?.delivery) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {copy.lockedTooltip}
          </CardContent>
        </Card>
      );
    }
    return (
      <ClientWebsiteSection
        project={activeProject}
        delivery={payload.delivery}
        copy={copy}
        locale={locale}
        portalToken={token}
        accountEmail={payload.account?.email}
        credentials={payload.credentials ?? []}
        resources={payload.resources ?? []}
        domains={payload.domains ?? []}
        corporateEmails={payload.corporate_emails ?? []}
      />
    );
  };

  const renderSecurity = () => {
    if (!activeProject) {
      return <p className="text-sm text-muted-foreground">{copy.selectProject}</p>;
    }
    if (!payload?.delivery) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {copy.lockedTooltip}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0D3B6E]">{copy.securityTitle}</h1>
          <p className="text-sm text-muted-foreground">{copy.securitySubtitle}</p>
        </div>
        <ClientCredentialsSection
          portalToken={token}
          dealId={activeProject.id}
          accountEmail={payload.account?.email}
          credentials={payload.credentials ?? []}
          copy={copy}
          locale={locale}
        />
      </div>
    );
  };

  const renderResources = () => {
    if (!activeProject) {
      return <p className="text-sm text-muted-foreground">{copy.selectProject}</p>;
    }
    if (!payload?.delivery) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {copy.lockedTooltip}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0D3B6E]">{copy.resources}</h1>
          <p className="text-sm text-muted-foreground">{copy.filesIntro}</p>
        </div>
        <ClientFilesSection resources={payload.resources ?? []} copy={copy} />
      </div>
    );
  };

  const renderPlaceholder = (title: string) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {copy.comingSoon}
      </CardContent>
    </Card>
  );

  const content = (() => {
    if (!token) {
      return (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {copy.noToken}
          </CardContent>
        </Card>
      );
    }
    if (loading) return <div className="text-sm text-muted-foreground">{copy.loading}</div>;
    if (error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      );
    }
    // New portal tabs are all rendered from a single website shell.
    return renderWebsite();
  })();

  return (
    <ClientPortalLayout
      locale={locale}
      onLocaleChange={setLocale}
      activeView={activeView}
      onViewChange={setView}
      websiteUnlocked={websiteUnlocked}
      deliveryDeliveredAt={
        delivery && typeof delivery === "object" && "delivered_at" in delivery
          ? String(delivery.delivered_at)
          : null
      }
      unreadNotifications={unreadNotifications}
      accountEmail={payload?.account?.email}
    >
      {content}
    </ClientPortalLayout>
  );
};
