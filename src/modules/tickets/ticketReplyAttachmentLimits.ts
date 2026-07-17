import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { DEFAULT_TICKET_WORKSPACE_SETTINGS } from "@/modules/settings/tickets/ticketWorkspaceSettings";
import { TICKET_WORKSPACE_SETTINGS_QUERY_KEY } from "@/modules/settings/tickets/useTicketWorkspaceSettings";

/** Workspace setting: max size embedded as a real email MIME attachment. */
export const MAX_TICKET_REPLY_ATTACHMENT_BYTES =
  DEFAULT_TICKET_WORKSPACE_SETTINGS.max_reply_attachment_bytes;

/** Absolute max for reply uploads (inline email OR 7-day download link). */
export const MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ticketAttachmentLimitLabel = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

export const TICKET_REPLY_ATTACHMENT_LIMIT_LABEL = ticketAttachmentLimitLabel(
  MAX_TICKET_REPLY_ATTACHMENT_BYTES,
);

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

export const isTicketReplyAttachmentTooLarge = (
  bytes: number,
  maxBytes = MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES,
) => bytes > maxBytes;

/** Over the email MIME cap, but still allowed as a 7-day storage download link. */
export const shouldSendTicketReplyAttachmentAsLink = (
  bytes: number,
  inlineMaxBytes: number,
) =>
  bytes > inlineMaxBytes &&
  bytes <= MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES;
