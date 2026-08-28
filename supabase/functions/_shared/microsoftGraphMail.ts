/** Use immutable message IDs so Graph IDs stay valid after move/archive. */
export const MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER = 'IdType="ImmutableId"';

export function microsoftGraphHeaders(
  accessToken: string,
  extra?: Record<string, string>,
  options?: { immutableId?: boolean },
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
  if (options?.immutableId !== false) {
    headers.Prefer = MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER;
  }
  return headers;
}

export async function readMicrosoftGraphError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  const code = (err as { error?: { code?: string } }).error?.code;
  const message = (err as { error?: { message?: string } }).error?.message;
  if (code && message) return `${code}: ${message}`;
  return message || `Graph request failed (${res.status})`;
}

/** Exchange/Graph errors when the stored REST id no longer matches the mailbox. */
export function isBenignMicrosoftMailError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found in the store") ||
    lower.includes("erroritemnotfound") ||
    lower.includes("item not found") ||
    lower.includes("failed to get the correct properties") ||
    lower.includes("invalid id") ||
    lower.includes("id is malformed")
  );
}

export function isMicrosoftThrottleError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("applicationthrottled") ||
    lower.includes("mailboxconcurrency") ||
    lower.includes("too many requests") ||
    lower.includes("throttl")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const wellKnownFolderIdCache = new Map<string, string>();

export async function resolveMicrosoftWellKnownFolderId(
  accessToken: string,
  wellKnownName: string,
): Promise<string> {
  const cacheKey = `${accessToken.slice(0, 12)}:${wellKnownName}`;
  const cached = wellKnownFolderIdCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(wellKnownName)}`,
    { headers: microsoftGraphHeaders(accessToken) },
  );
  if (res.status === 429 || res.status === 503) {
    await sleep(1500);
    const retry = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(wellKnownName)}`,
      { headers: microsoftGraphHeaders(accessToken) },
    );
    if (!retry.ok) {
      throw new Error(await readMicrosoftGraphError(retry));
    }
    const json = (await retry.json()) as { id?: string };
    const id = String(json.id || wellKnownName);
    wellKnownFolderIdCache.set(cacheKey, id);
    return id;
  }
  if (!res.ok) {
    throw new Error(await readMicrosoftGraphError(res));
  }
  const json = (await res.json()) as { id?: string };
  const id = String(json.id || wellKnownName);
  wellKnownFolderIdCache.set(cacheKey, id);
  return id;
}

export async function refreshMicrosoftMessageIdsForConversation(
  accessToken: string,
  conversationId: string,
): Promise<string[]> {
  const filter = encodeURIComponent(
    `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
  );
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${filter}&$select=id&$top=50`,
    { headers: microsoftGraphHeaders(accessToken) },
  );
  if (!res.ok) {
    throw new Error(await readMicrosoftGraphError(res));
  }
  const json = (await res.json()) as { value?: Array<{ id?: string }> };
  return (json.value ?? [])
    .map((row) => String(row.id || ""))
    .filter(Boolean);
}

async function messageExists(
  accessToken: string,
  messageId: string,
): Promise<boolean> {
  for (const immutableId of [true, false] as const) {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=id`,
      { headers: microsoftGraphHeaders(accessToken, {}, { immutableId }) },
    );
    if (res.ok) return true;
    if (res.status !== 404 && res.status !== 400) {
      const msg = await readMicrosoftGraphError(res);
      if (!isBenignMicrosoftMailError(msg)) {
        throw new Error(msg);
      }
    }
  }
  return false;
}

export async function resolveMicrosoftThreadMessageIds(
  accessToken: string,
  conversationId: string | null | undefined,
  storedIds: string[],
): Promise<string[]> {
  const uniqueStored = [...new Set(storedIds.filter(Boolean))];

  if (conversationId?.trim()) {
    try {
      const fresh = await refreshMicrosoftMessageIdsForConversation(
        accessToken,
        conversationId.trim(),
      );
      if (fresh.length > 0) return [...new Set(fresh)];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!isBenignMicrosoftMailError(msg)) throw error;
    }
  }

  const resolved: string[] = [];
  for (const id of uniqueStored) {
    if (await messageExists(accessToken, id)) {
      resolved.push(id);
    }
  }
  return resolved;
}

export async function graphMessageFetch(
  accessToken: string,
  relativePath: string,
  init: RequestInit,
): Promise<Response> {
  const fullUrl = `https://graph.microsoft.com/v1.0/me${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}`;

  let res = await fetch(fullUrl, {
    ...init,
    headers: {
      ...microsoftGraphHeaders(accessToken),
      ...(init.headers ?? {}),
    },
  });

  // MailboxConcurrency / ApplicationThrottled — brief backoff then retry once.
  if (res.status === 429 || res.status === 503) {
    const retryAfterRaw = res.headers.get("Retry-After");
    const retryAfterSec = Number.parseInt(retryAfterRaw ?? "", 10);
    const waitMs = Number.isFinite(retryAfterSec)
      ? Math.min(Math.max(retryAfterSec, 1), 10) * 1000
      : 1500;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await fetch(fullUrl, {
      ...init,
      headers: {
        ...microsoftGraphHeaders(accessToken),
        ...(init.headers ?? {}),
      },
    });
  }

  if (res.ok) return res;
  if (res.status !== 404 && res.status !== 400 && res.status !== 409) {
    return res;
  }

  const firstError = await readMicrosoftGraphError(res.clone());
  if (!isBenignMicrosoftMailError(firstError)) return res;

  const retryHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    if (typeof value === "string" && key.toLowerCase() !== "prefer") {
      retryHeaders[key] = value;
    }
  }

  return fetch(fullUrl, {
    ...init,
    headers: retryHeaders,
  });
}

export async function handleMicrosoftGraphResponse(
  res: Response,
  options?: { allowMissing?: boolean },
): Promise<Record<string, unknown> | null> {
  if (res.status === 404 && options?.allowMissing) return null;
  if (!res.ok) {
    const msg = await readMicrosoftGraphError(res);
    if (options?.allowMissing && isBenignMicrosoftMailError(msg)) return null;
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}
