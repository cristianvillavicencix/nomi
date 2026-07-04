import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { DEFAULT_TICKET_WORKSPACE_SETTINGS } from "@/modules/settings/tickets/ticketWorkspaceSettings";
import { TICKET_WORKSPACE_SETTINGS_QUERY_KEY } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

export const MAX_TICKET_REPLY_ATTACHMENT_BYTES =
  DEFAULT_TICKET_WORKSPACE_SETTINGS.max_reply_attachment_bytes;

export const useTicketAttachmentLimitBytes = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data } = useQuery({
    queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getTicketWorkspaceSettings(),
    staleTime: 60_000,
  });
  return (
    data?.workspace.max_reply_attachment_bytes ??
    MAX_TICKET_REPLY_ATTACHMENT_BYTES
  );
};

export const ticketAttachmentLimitLabel = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

export const isTicketReplyAttachmentTooLarge = (
  bytes: number,
  maxBytes = MAX_TICKET_REPLY_ATTACHMENT_BYTES,
) => bytes > maxBytes;
