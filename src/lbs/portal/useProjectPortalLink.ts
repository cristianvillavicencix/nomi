import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { ClientPortalAccount, LbsDeal } from "@/lbs/types";

export const getProjectPortalUrl = (token: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal?token=${encodeURIComponent(token)}`;
};

export const useProjectPortalLink = (record: LbsDeal) => {
  const contactId = record.contact_id ?? record.contact_ids?.[0];

  const { data: accounts = [], isPending } = useGetList<ClientPortalAccount>(
    "client_portal_accounts",
    {
      filter: contactId ? { "contact_id@eq": contactId } : { id: -1 },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: !!contactId },
  );

  const portalLink = useMemo(() => {
    const account = accounts[0];
    if (!account?.invitation_token) return null;
    return getProjectPortalUrl(account.invitation_token);
  }, [accounts]);

  return {
    contactId,
    portalLink,
    isPending: !!contactId && isPending,
  };
};
