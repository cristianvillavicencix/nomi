import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { getConversationTypeLabel } from "@/lbs/messages/conversationUtils";
import { getOtherDmMemberId } from "@/lbs/messages/useDirectMessage";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

export const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export const formatConversationListTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export type ConversationDisplay = {
  title: string;
  initials: string;
  preview: string;
  typeLabel: string;
  activityAt?: string | null;
  dealHref?: string;
  memberAvatarSrc?: string | null;
};

export const getConversationDisplay = ({
  conversation,
  deals,
  dmParticipants,
  members,
  contacts = [],
  currentMemberId,
}: {
  conversation: Conversation;
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
}): ConversationDisplay => {
  const typeLabel = getConversationTypeLabel(conversation.type);
  const activityAt = conversation.last_message_at ?? conversation.updated_at;
  const messagePreview =
    conversation.last_message_preview?.trim() ||
    (conversation.last_message_at ? "New message" : null);

  if (conversation.type === "client") {
    const contact =
      conversation.contact_id != null
        ? contacts.find((entry) => String(entry.id) === String(conversation.contact_id))
        : undefined;
    const title =
      (contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : "") ||
      conversation.title ||
      (conversation.external_phone
        ? formatUsPhoneDisplayFromAny(conversation.external_phone)
        : "Client SMS");
    const companyName = contact?.company_name?.trim();

    return {
      title,
      initials: getInitials(title),
      preview: messagePreview || companyName || "No messages yet",
      typeLabel,
      activityAt,
      dealHref:
        conversation.deal_id != null
          ? `/deals/${conversation.deal_id}/show`
          : contact?.id != null
            ? `/contacts/${contact.id}/show`
            : undefined,
    };
  }

  if (conversation.type === "project") {
    const deal =
      conversation.deal_id != null
        ? deals.find((entry) => String(entry.id) === String(conversation.deal_id))
        : undefined;
    const title = deal?.name ?? conversation.title ?? "Project team";

    return {
      title,
      initials: getInitials(title),
      preview: messagePreview || "Start the project conversation",
      typeLabel,
      activityAt,
      dealHref:
        conversation.deal_id != null
          ? `/deals/${conversation.deal_id}/show?tab=messages`
          : undefined,
    };
  }

  const participantIds = dmParticipants
    .filter((entry) => String(entry.conversation_id) === String(conversation.id))
    .map((entry) => entry.member_id);

  const otherMemberId = getOtherDmMemberId(
    conversation,
    participantIds,
    currentMemberId,
  );
  const otherMember =
    otherMemberId != null
      ? members.find((entry) => String(entry.id) === String(otherMemberId))
      : undefined;

  const title = otherMember
    ? `${otherMember.first_name ?? ""} ${otherMember.last_name ?? ""}`.trim()
    : conversation.title ?? "Direct message";

  return {
    title: title || "Direct message",
    initials: getInitials(title || "DM"),
    preview: messagePreview || "Say hello",
    typeLabel,
    activityAt,
    memberAvatarSrc: otherMember?.avatar?.src ?? null,
  };
};
