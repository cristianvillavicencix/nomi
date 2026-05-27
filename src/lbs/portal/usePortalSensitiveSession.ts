import { useCallback, useEffect, useMemo, useState } from "react";
import {
  requestPortalSensitiveCode,
  verifyPortalSensitiveCode,
  type PortalSensitiveSession,
} from "@/lbs/portal/portalCredentialsApi";

const storageKey = (portalToken: string) =>
  `lbs.client_portal.sensitive_session.${portalToken.slice(0, 12)}`;

type StoredSession = PortalSensitiveSession & {
  accountEmail?: string;
};

const readStoredSession = (portalToken: string): StoredSession | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(portalToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.sensitive_session || !parsed.expires_at) return null;
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      sessionStorage.removeItem(storageKey(portalToken));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const usePortalSensitiveSession = (
  portalToken: string,
  accountEmail?: string | null,
) => {
  const [session, setSession] = useState<StoredSession | null>(() =>
    portalToken ? readStoredSession(portalToken) : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    setSession(portalToken ? readStoredSession(portalToken) : null);
  }, [portalToken]);

  const isActive = useMemo(() => {
    if (!session?.expires_at) return false;
    return new Date(session.expires_at).getTime() > Date.now();
  }, [session]);

  const persistSession = useCallback(
    (next: PortalSensitiveSession) => {
      const stored: StoredSession = {
        ...next,
        accountEmail: accountEmail ?? undefined,
      };
      sessionStorage.setItem(storageKey(portalToken), JSON.stringify(stored));
      setSession(stored);
    },
    [accountEmail, portalToken],
  );

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(storageKey(portalToken));
    setSession(null);
  }, [portalToken]);

  const requestCode = useCallback(async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await requestPortalSensitiveCode(portalToken);
      setCodeSent(true);
      setCodeExpiresAt(res.expires_at);
    } catch (error) {
      setConfirmError(
        error instanceof Error ? error.message : "Could not send code",
      );
    } finally {
      setConfirming(false);
    }
  }, [portalToken]);

  const verifyCode = useCallback(
    async (code: string) => {
      setConfirming(true);
      setConfirmError(null);
      try {
        const next = await verifyPortalSensitiveCode({ portalToken, code });
        persistSession(next);
        setConfirmOpen(false);
        setCodeSent(false);
        setCodeExpiresAt(null);
        pendingAction?.();
        setPendingAction(null);
      } catch (error) {
        setConfirmError(
          error instanceof Error ? error.message : "Could not verify code",
        );
      } finally {
        setConfirming(false);
      }
    },
    [pendingAction, persistSession, portalToken],
  );

  const requireSensitiveSession = useCallback(
    (action: () => void) => {
      if (isActive && session?.sensitive_session) {
        action();
        return;
      }
      setPendingAction(() => action);
      setConfirmOpen(true);
    },
    [isActive, session?.sensitive_session],
  );

  const expiresLabel = useMemo(() => {
    if (!session?.expires_at || !isActive) return null;
    return new Date(session.expires_at).toLocaleTimeString();
  }, [isActive, session?.expires_at]);

  return {
    session,
    isActive,
    confirmOpen,
    setConfirmOpen,
    confirming,
    confirmError,
    requestCode,
    verifyCode,
    codeSent,
    codeExpiresAt,
    requireSensitiveSession,
    clearSession,
    expiresLabel,
    sensitiveSessionToken: isActive ? session?.sensitive_session ?? null : null,
  };
};
