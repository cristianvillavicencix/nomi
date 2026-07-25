import { useCallback, useEffect, useMemo, useState } from "react";
import {
  endPortalLoginSession,
  requestPortalLoginCode,
  verifyPortalLoginCode,
} from "@/modules/portal/portalAuthApi";
import {
  clearPortalAuthSession,
  isPortalAuthSessionActive,
  PORTAL_IDLE_MS,
  readPortalAuthSession,
  touchPortalAuthSession,
  writePortalAuthSession,
  type StoredPortalAuthSession,
} from "@/modules/portal/portalAuthSession";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "mousemove",
] as const;

export const usePortalAuthSession = (portalToken: string) => {
  const [session, setSession] = useState<StoredPortalAuthSession | null>(() =>
    portalToken ? readPortalAuthSession(portalToken) : null,
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);

  const syncSession = useCallback(() => {
    const stored = portalToken ? readPortalAuthSession(portalToken) : null;
    if (!isPortalAuthSessionActive(stored)) {
      if (stored) clearPortalAuthSession(portalToken);
      setSession(null);
      return null;
    }
    setSession(stored);
    return stored;
  }, [portalToken]);

  useEffect(() => {
    syncSession();
  }, [portalToken, syncSession]);

  const isActive = useMemo(() => isPortalAuthSessionActive(session), [session]);

  const sessionToken = isActive ? (session?.sensitive_session ?? null) : null;

  useEffect(() => {
    if (!portalToken || !isActive || !session) return;

    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch < 30_000) return;
      lastTouch = now;
      setSession((current) => {
        if (!current) return current;
        return touchPortalAuthSession(portalToken, current);
      });
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    const intervalId = window.setInterval(() => {
      const stored = readPortalAuthSession(portalToken);
      if (!isPortalAuthSessionActive(stored)) {
        clearPortalAuthSession(portalToken);
        setSession(null);
      }
    }, 60_000);

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
      window.clearInterval(intervalId);
    };
  }, [isActive, portalToken, session]);

  const requestCode = useCallback(async () => {
    if (!portalToken) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await requestPortalLoginCode(portalToken);
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
      if (!portalToken) return;
      setConfirming(true);
      setConfirmError(null);
      try {
        const next = await verifyPortalLoginCode({ portalToken, code });
        const stored = writePortalAuthSession(portalToken, next);
        setSession(stored);
        setCodeSent(false);
        setCodeExpiresAt(null);
      } catch (error) {
        setConfirmError(
          error instanceof Error ? error.message : "Could not verify code",
        );
      } finally {
        setConfirming(false);
      }
    },
    [portalToken],
  );

  const signOut = useCallback(async () => {
    const current = readPortalAuthSession(portalToken);
    clearPortalAuthSession(portalToken);
    setSession(null);
    setCodeSent(false);
    setCodeExpiresAt(null);
    setConfirmError(null);
    if (current?.sensitive_session) {
      try {
        await endPortalLoginSession({
          portalToken,
          portalSession: current.sensitive_session,
        });
      } catch {
        // Local sign-out still applies if the network call fails.
      }
    }
  }, [portalToken]);

  const idleMinutes = Math.round(PORTAL_IDLE_MS / 60_000);

  return {
    session,
    isActive,
    sessionToken,
    confirming,
    confirmError,
    codeSent,
    codeExpiresAt,
    requestCode,
    verifyCode,
    signOut,
    idleMinutes,
    syncSession,
  };
};
