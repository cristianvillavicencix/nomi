import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export type PortalSensitiveSession = {
  sensitive_session: string;
  expires_at: string;
};

export const invokePortalCredentials = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke(
    "client_portal_credentials",
    { body },
  );
  if (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : "Request failed";
    throw new Error(message);
  }
  if (data && typeof data === "object" && "message" in data && "status" in data) {
    throw new Error(String((data as { message?: string }).message ?? "Request failed"));
  }
  return data as Record<string, unknown>;
};

export const startPortalSensitiveSession = async (
  portalToken: string,
  emailConfirm: string,
): Promise<PortalSensitiveSession> => {
  const data = await invokePortalCredentials({
    token: portalToken,
    action: "start_sensitive_session",
    email_confirm: emailConfirm,
  });
  return {
    sensitive_session: String(data.sensitive_session ?? ""),
    expires_at: String(data.expires_at ?? ""),
  };
};

export const revealPortalCredentialPassword = async (params: {
  portalToken: string;
  sensitiveSession: string;
  dealId: number;
  entryId: number;
  kind?: string | null;
}) => {
  const data = await invokePortalCredentials({
    token: params.portalToken,
    action: "reveal_password",
    sensitive_session: params.sensitiveSession,
    deal_id: params.dealId,
    entry_id: params.entryId,
    kind: params.kind ?? null,
  });
  return data.password != null ? String(data.password) : null;
};

export const logPortalCredentialCopy = async (params: {
  portalToken: string;
  sensitiveSession: string;
  dealId: number;
  entryId: number;
  kind?: string | null;
}) => {
  await invokePortalCredentials({
    token: params.portalToken,
    action: "log_copy",
    sensitive_session: params.sensitiveSession,
    deal_id: params.dealId,
    entry_id: params.entryId,
    kind: params.kind ?? null,
  });
};
