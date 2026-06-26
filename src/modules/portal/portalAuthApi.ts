import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { readSupabaseFunctionErrorMessage } from "@/lib/supabaseEdgeFunction";
import type { PortalPayload } from "@/modules/portal/portalTypes";

export type PortalBootstrapPayload = {
  account: { email: string };
};

export const bootstrapPortal = async (token: string) => {
  const { data, error } = await supabase.functions.invoke("client_portal", {
    body: { token, action: "bootstrap" },
  });
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not load portal"),
    );
  }
  return data as PortalBootstrapPayload;
};

export const fetchAuthenticatedPortal = async (
  token: string,
  portalSession: string,
  dealId?: number,
) => {
  const { data, error } = await supabase.functions.invoke("client_portal", {
    body: dealId
      ? { token, portal_session: portalSession, deal_id: dealId }
      : { token, portal_session: portalSession },
  });
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not load portal"),
    );
  }
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    !("account" in data)
  ) {
    throw new Error(
      String((data as { message?: string }).message ?? "Could not load portal"),
    );
  }
  return data as PortalPayload;
};

export const requestPortalLoginCode = async (portalToken: string) => {
  const { data, error } = await supabase.functions.invoke(
    "client_portal_credentials",
    {
      body: {
        token: portalToken,
        action: "request_portal_login_code",
      },
    },
  );
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not send code"),
    );
  }
  return {
    expires_at: String((data as { expires_at?: string })?.expires_at ?? ""),
  };
};

export const verifyPortalLoginCode = async (params: {
  portalToken: string;
  code: string;
}) => {
  const { data, error } = await supabase.functions.invoke(
    "client_portal_credentials",
    {
      body: {
        token: params.portalToken,
        action: "verify_portal_login_code",
        code: params.code,
      },
    },
  );
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not verify code"),
    );
  }
  return {
    sensitive_session: String(
      (data as { sensitive_session?: string })?.sensitive_session ?? "",
    ),
    expires_at: String((data as { expires_at?: string })?.expires_at ?? ""),
  };
};

export const endPortalLoginSession = async (params: {
  portalToken: string;
  portalSession: string;
}) => {
  await supabase.functions.invoke("client_portal_credentials", {
    body: {
      token: params.portalToken,
      action: "end_portal_session",
      portal_session: params.portalSession,
    },
  });
};

export const requestEmailLoginCode = async (email: string) => {
  const { data, error } = await supabase.functions.invoke(
    "client_portal_credentials",
    {
      body: {
        action: "request_email_login_code",
        email: email.trim(),
      },
    },
  );
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not send code"),
    );
  }
  return {
    expires_at: String((data as { expires_at?: string })?.expires_at ?? ""),
  };
};

export const verifyEmailLoginCode = async (params: {
  email: string;
  code: string;
}) => {
  const { data, error } = await supabase.functions.invoke(
    "client_portal_credentials",
    {
      body: {
        action: "verify_email_login_code",
        email: params.email.trim(),
        code: params.code,
      },
    },
  );
  if (error) {
    throw new Error(
      await readSupabaseFunctionErrorMessage(error, "Could not verify code"),
    );
  }
  return {
    invitation_token: String(
      (data as { invitation_token?: string })?.invitation_token ?? "",
    ),
    sensitive_session: String(
      (data as { sensitive_session?: string })?.sensitive_session ?? "",
    ),
    expires_at: String((data as { expires_at?: string })?.expires_at ?? ""),
    account: {
      email: String(
        (data as { account?: { email?: string } })?.account?.email ??
          params.email,
      ),
    },
  };
};
