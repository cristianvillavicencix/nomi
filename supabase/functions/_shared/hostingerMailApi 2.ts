const HOSTINGER_MAIL_API_BASE = "https://api.mail.hostinger.com";

export type HostingerMailMailbox = {
  resource_id?: string | null;
  address?: string | null;
};

type HostingerMailMeResponse = {
  data?: {
    mailboxes?: HostingerMailMailbox[] | null;
  } | null;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message ?? payload.error ?? response.statusText;
  } catch {
    return response.statusText || "Hostinger Mail API request failed";
  }
};

export async function fetchHostingerMailboxes(
  mailApiToken: string,
): Promise<HostingerMailMailbox[]> {
  const response = await fetch(`${HOSTINGER_MAIL_API_BASE}/api/v1/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mailApiToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as HostingerMailMeResponse;
  return payload.data?.mailboxes ?? [];
}

export function filterMailboxesForDomain(
  mailboxes: HostingerMailMailbox[],
  domain: string,
): HostingerMailMailbox[] {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) return [];

  return mailboxes
    .filter((mailbox) => {
      const address = mailbox.address?.trim().toLowerCase() ?? "";
      return address.endsWith(`@${normalizedDomain}`);
    })
    .sort((left, right) =>
      (left.address ?? "").localeCompare(right.address ?? "", undefined, {
        sensitivity: "base",
      })
    );
}

export async function testHostingerMailConnection(mailApiToken: string) {
  await fetchHostingerMailboxes(mailApiToken);
  return { ok: true as const };
}
