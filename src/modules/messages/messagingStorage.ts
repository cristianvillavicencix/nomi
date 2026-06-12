export const MESSAGING_ATTACHMENTS_BUCKET = "messaging-attachments";

/** Legacy public attachments bucket (pre-hotfix #4). */
export const LEGACY_ATTACHMENTS_BUCKET = "attachments";

export const isLegacyPublicMediaUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

export const buildMessagingAttachmentPath = (
  orgId: string | number,
  conversationId: string | number,
  fileName: string,
) => `org_${orgId}/conversation_${conversationId}/${fileName}`;

export const buildMessagingAttachmentPathOutbound = (
  orgId: string | number,
  fileName: string,
) => `org_${orgId}/outbound/${fileName}`;
