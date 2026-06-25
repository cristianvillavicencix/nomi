import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ClientPortalLayout } from "@/modules/portal/ClientPortalLayout";
import { ClientWebsiteSection } from "@/modules/portal/ClientWebsiteSection";
import { PortalLoginGate } from "@/modules/portal/PortalLoginGate";
import {
  bootstrapPortal,
  fetchAuthenticatedPortal,
  requestEmailLoginCode,
  verifyEmailLoginCode,
} from "@/modules/portal/portalAuthApi";
import { writePortalAuthSession } from "@/modules/portal/portalAuthSession";
import {
  getPortalCopy,
  PORTAL_LOCALE_KEY,
  type PortalLocale,
} from "@/modules/portal/portalI18n";
import { parsePortalView } from "@/modules/portal/portalNavigation";
import type { PortalDelivery, PortalPayload } from "@/modules/portal/portalTypes";
import { usePortalAuthSession } from "@/modules/portal/usePortalAuthSession";

const PORTAL_TOKEN_KEY = "lbs.client_portal.token";

const readProjectId = (value: string | null): number | null => {
  if (value == null || value.trim() === "") return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const isInvalidPortalLinkError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid") ||
    normalized.includes("expired") ||
    normalized.includes("portal link")
  );
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
  const [loading, setLoading] = useState(() => Boolean(token.trim()));
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [bootstrapEmail, setBootstrapEmail] = useState<string | null>(null);
  const [emailLoginConfirming, setEmailLoginConfirming] = useState(false);
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeExpiresAt, setEmailCodeExpiresAt] = useState<string | null>(null);

  const portalAuth = usePortalAuthSession(token.trim());
  const selectedDealId = readProjectId(searchParams.get("project"));
  const activeView = parsePortalView(searchParams.get("view"));
  const copy = getPortalCopy(locale);
  const hasToken = Boolean(token.trim());

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl?.trim()) {
      setToken(tokenFromUrl.trim());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token.trim()) {
      setLoading(false);
      setPayload(null);
      setBootstrapEmail(null);
      return;
    }
    localStorage.setItem(PORTAL_TOKEN_KEY, token.trim());
  }, [token]);

  useEffect(() => {
    if (!token.trim() || portalAuth.isActive) return;
    setLoading(true);
    setError(null);
    void bootstrapPortal(token.trim())
      .then((data) => {
        setBootstrapEmail(data.account?.email ?? null);
        setPayload(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load portal";
        if (isInvalidPortalLinkError(message)) {
          localStorage.removeItem(PORTAL_TOKEN_KEY);
          setToken("");
        }
        setBootstrapEmail(null);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [portalAuth.isActive, token]);

  const {
    isActive: isPortalAuthActive,
    sessionToken,
    signOut: signOutPortal,
  } = portalAuth;

  useEffect(() => {
    if (!token.trim() || !isPortalAuthActive || !sessionToken) {
      if (!isPortalAuthActive) {
        setPayload(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    void fetchAuthenticatedPortal(
      token.trim(),
      sessionToken,
      selectedDealId ?? undefined,
    )
      .then((data) => {
        setPayload(data);
        setBootstrapEmail(data.account?.email ?? null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load portal";
        if (message.toLowerCase().includes("session")) {
          void signOutPortal();
        }
        setPayload(null);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [isPortalAuthActive, selectedDealId, sessionToken, signOutPortal, token]);

  useEffect(() => {
    if (!token.trim() || !payload || selectedDealId != null) return;
    const deliveredProject = (payload.projects ?? []).find(
      (project) => project.delivery,
    );
    if (!deliveredProject) return;
    const next = new URLSearchParams(searchParams);
    next.set("project", String(deliveredProject.id));
    setSearchParams(next, { replace: true });
  }, [payload, searchParams, selectedDealId, setSearchParams, token]);

  const activeProject = useMemo(() => {
    if (payload?.project) return payload.project;
    if (selectedDealId != null) {
      return (
        (payload?.projects ?? []).find((project) => project.id === selectedDealId) ??
        null
      );
    }
    return (payload?.projects ?? [])[0] ?? null;
  }, [payload, selectedDealId]);

  const delivery: PortalDelivery | null = useMemo(() => {
    if (payload?.delivery) return payload.delivery;
    const summary = activeProject?.delivery;
    if (!summary) return null;
    return {
      id: 0,
      delivered_at: String(summary.delivered_at ?? ""),
      site_url: summary.site_url ?? null,
      delivery_date: summary.delivery_date ?? null,
    };
  }, [activeProject?.delivery, payload?.delivery]);

  const websiteUnlocked = Boolean(delivery?.delivered_at);
  const unreadNotifications =
    payload?.notifications?.filter((entry) => !entry.read_at).length ?? 0;
  const accountEmail = payload?.account?.email ?? bootstrapEmail;

  const setView = (view: ReturnType<typeof parsePortalView>) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    setSearchParams(next, { replace: true });
  };

  const resetEmailLoginState = () => {
    setEmailLoginConfirming(false);
    setEmailLoginError(null);
    setEmailCodeSent(false);
    setEmailCodeExpiresAt(null);
  };

  const handleSignOut = useCallback(async () => {
    await signOutPortal();
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    setToken("");
    setPayload(null);
    setBootstrapEmail(null);
    setError(null);
    resetEmailLoginState();
  }, [signOutPortal]);

  const handleRequestCode = useCallback(
    async (email: string) => {
      if (hasToken) {
        await portalAuth.requestCode();
        return;
      }

      setEmailLoginConfirming(true);
      setEmailLoginError(null);
      try {
        const res = await requestEmailLoginCode(email);
        setEmailCodeSent(true);
        setEmailCodeExpiresAt(res.expires_at);
      } catch (err: unknown) {
        setEmailLoginError(
          err instanceof Error ? err.message : "Could not send code",
        );
      } finally {
        setEmailLoginConfirming(false);
      }
    },
    [hasToken, portalAuth],
  );

  const handleVerifyCode = useCallback(
    async (email: string, code: string) => {
      if (hasToken) {
        await portalAuth.verifyCode(code);
        return;
      }

      setEmailLoginConfirming(true);
      setEmailLoginError(null);
      try {
        const session = await verifyEmailLoginCode({ email, code });
        if (!session.invitation_token || !session.sensitive_session) {
          throw new Error("Could not start portal session");
        }
        writePortalAuthSession(session.invitation_token, {
          sensitive_session: session.sensitive_session,
          expires_at: session.expires_at,
        });
        localStorage.setItem(PORTAL_TOKEN_KEY, session.invitation_token);
        setBootstrapEmail(session.account.email);
        setToken(session.invitation_token);
        resetEmailLoginState();
        setError(null);
      } catch (err: unknown) {
        setEmailLoginError(
          err instanceof Error ? err.message : "Could not verify code",
        );
      } finally {
        setEmailLoginConfirming(false);
      }
    },
    [hasToken, portalAuth],
  );

  const content = (() => {
    if (!isPortalAuthActive) {
      if (hasToken && loading && !bootstrapEmail) {
        return <div className="p-6 text-sm text-muted-foreground">{copy.loading}</div>;
      }

      return (
        <PortalLoginGate
          copy={copy}
          accountEmail={accountEmail}
          emailEditable={!hasToken}
          confirming={hasToken ? portalAuth.confirming : emailLoginConfirming}
          error={
            hasToken
              ? portalAuth.confirmError ?? error
              : emailLoginError ?? error
          }
          codeSent={hasToken ? portalAuth.codeSent : emailCodeSent}
          codeExpiresAt={hasToken ? portalAuth.codeExpiresAt : emailCodeExpiresAt}
          idleMinutes={portalAuth.idleMinutes}
          onRequestCode={(email) => void handleRequestCode(email)}
          onVerifyCode={(email, code) => void handleVerifyCode(email, code)}
        />
      );
    }

    if (loading) {
      return <div className="p-6 text-sm text-muted-foreground">{copy.loading}</div>;
    }
    if (error) {
      return (
        <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      );
    }
    if (!activeProject) {
      return (
        <p className="p-6 text-sm text-muted-foreground">{copy.selectProject}</p>
      );
    }
    if (!delivery?.delivered_at) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {copy.lockedTooltip}
        </div>
      );
    }
    if (!payload?.delivery) {
      return (
        <div className="p-6 text-sm text-muted-foreground">{copy.loading}</div>
      );
    }
    return (
      <ClientWebsiteSection
        project={activeProject}
        delivery={payload.delivery}
        copy={copy}
        locale={locale}
        onLocaleChange={setLocale}
        portalToken={token}
        accountEmail={accountEmail}
        credentials={payload.credentials ?? []}
        resources={payload.resources ?? []}
        domains={payload.domains ?? []}
        corporateEmails={payload.corporate_emails ?? []}
        invoices={payload.invoices ?? []}
        payments={payload.payments ?? []}
        activeView={activeView}
        onViewChange={setView}
        onSignOut={() => void handleSignOut()}
      />
    );
  })();

  return (
    <ClientPortalLayout
      locale={locale}
      onLocaleChange={setLocale}
      activeView={activeView}
      onViewChange={setView}
      websiteUnlocked={websiteUnlocked}
      deliveryDeliveredAt={delivery?.delivered_at ?? null}
      unreadNotifications={unreadNotifications}
      accountEmail={accountEmail}
    >
      {content}
    </ClientPortalLayout>
  );
};
