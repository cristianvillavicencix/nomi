/** Delegated scopes for Outlook mail via Microsoft Graph. User.Read is required for GET /me. */
export const MICROSOFT_MAIL_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
] as const;

export function microsoftMailOAuthScopeString(): string {
  return MICROSOFT_MAIL_OAUTH_SCOPES.join(" ");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function emailFromIdToken(idToken: string): string {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return "";
  const candidate =
    payload.email ??
    payload.preferred_username ??
    payload.upn ??
    payload.unique_name;
  return String(candidate || "").trim().toLowerCase();
}

export async function resolveMicrosoftMailboxEmail(
  accessToken: string,
  idToken?: string | null,
): Promise<{ email: string; error?: string }> {
  if (idToken) {
    const fromToken = emailFromIdToken(idToken);
    if (fromToken) return { email: fromToken };
  }

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = (await profileRes.json()) as {
    mail?: string;
    userPrincipalName?: string;
    error?: { message?: string };
  };

  if (profileRes.ok) {
    const email = String(
      profile.mail || profile.userPrincipalName || "",
    )
      .trim()
      .toLowerCase();
    if (email) return { email };
  }

  const graphError =
    profile.error?.message?.trim() ||
    (!profileRes.ok ? `Microsoft Graph profile failed (${profileRes.status})` : "");

  return {
    email: "",
    error:
      graphError ||
      "Could not read the Microsoft account email. Ensure the Azure app has User.Read and Mail permissions.",
  };
}
