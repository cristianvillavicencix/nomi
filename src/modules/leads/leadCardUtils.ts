import type { Identifier } from "ra-core";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Globe,
  Instagram,
  Megaphone,
  PhoneIncoming,
  Search,
  Share2,
  UserRoundPlus,
} from "lucide-react";

import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import type { Conversation } from "@/modules/types";
import { getInitials } from "@/modules/messages/conversationDisplay";
import { assignedMemberIdsFromContact } from "@/modules/leads/leadAssignments";
import {
  LBS_LEAD_SOURCE_CHOICES,
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/modules/leads/leadFormConstants";
import type { LeadStageId } from "@/modules/leads/leadStages";
import { normalizeLeadStage } from "@/modules/leads/leadStages";
import { normalizePhoneForTel } from "@/lib/linking";

const QUOTE_AMOUNT_STAGES = new Set<LeadStageId>(["quoted", "closing", "won"]);
const STALE_ACTIVITY_DAYS = 4;

const MEMBER_ACCENT_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#6366f1",
  "#ef4444",
] as const;

export type LeadActivitySummary = {
  label: string;
  at: string | null;
};

export const getLeadDisplayName = (lead: Contact) =>
  `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
  lead.company_name ||
  "Unnamed lead";

export const getLeadPrimaryEmail = (lead: Contact) =>
  lead.email_jsonb?.find((entry) => String(entry.email ?? "").trim())?.email ??
  null;

export const getLeadPrimaryPhone = (lead: Contact) =>
  lead.phone_jsonb?.find((entry) => String(entry.number ?? "").trim())
    ?.number ?? null;

export const getLeadPrimaryPhoneDisplay = (lead: Contact) => {
  const phone = getLeadPrimaryPhone(lead);
  if (!phone) return null;
  return normalizePhoneForTel(phone);
};

export const shouldShowLeadEmail = (lead: Contact) => {
  const stage = normalizeLeadStage(lead.lead_stage);
  return stage !== "new" && Boolean(getLeadPrimaryEmail(lead));
};

export const shouldShowLeadQuoteAmount = (lead: Contact) => {
  const stage = normalizeLeadStage(lead.lead_stage);
  return (
    QUOTE_AMOUNT_STAGES.has(stage) &&
    lead.lead_value_estimate != null &&
    !Number.isNaN(Number(lead.lead_value_estimate))
  );
};

export const getLeadAssigneeMemberId = (lead: Contact) =>
  assignedMemberIdsFromContact(lead)[0] ?? null;

export const getMemberDisplayName = (
  member: Pick<OrganizationMember, "first_name" | "last_name">,
) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") ||
  "Team member";

export const getMemberInitials = (
  member: Pick<OrganizationMember, "first_name" | "last_name">,
) => getInitials(getMemberDisplayName(member));

export const getMemberAccentColor = (memberId: Identifier) => {
  const numeric = Number(memberId);
  const index = Number.isFinite(numeric)
    ? Math.abs(Math.trunc(numeric))
    : String(memberId).length;
  return MEMBER_ACCENT_COLORS[index % MEMBER_ACCENT_COLORS.length];
};

export const getLeadSourceIcon = (
  source?: string | null,
): { Icon: LucideIcon; label: string } => {
  switch (source) {
    case "Google":
      return { Icon: Search, label: "Google" };
    case LBS_LEAD_SOURCE_REFERRAL:
      return { Icon: UserRoundPlus, label: "Referral" };
    case "WebSite Visit":
      return { Icon: Globe, label: "Website form" };
    case "TikTok":
      return { Icon: Megaphone, label: "TikTok" };
    case "Facebook":
      return { Icon: Share2, label: "Facebook" };
    case "Instagram":
      return { Icon: Instagram, label: "Instagram" };
    case "Llamada en frío":
      return { Icon: PhoneIncoming, label: "Cold call" };
    case LBS_LEAD_SOURCE_OTHER:
      return { Icon: CircleHelp, label: "Other source" };
    default:
      return {
        Icon: CircleHelp,
        label:
          LBS_LEAD_SOURCE_CHOICES.find((choice) => choice.id === source)
            ?.name ?? "Lead source",
      };
  }
};

export const resolveLeadLastActivity = (
  lead: Contact,
  conversation?: Conversation | null,
): LeadActivitySummary => {
  const candidates: LeadActivitySummary[] = [];

  if (conversation?.last_message_at) {
    candidates.push({ label: "SMS", at: conversation.last_message_at });
  }
  if (lead.last_contacted_at) {
    candidates.push({ label: "Contacted", at: lead.last_contacted_at });
  }
  if (lead.last_seen) {
    candidates.push({ label: "Activity", at: lead.last_seen });
  }

  const best = candidates.sort(
    (left, right) =>
      new Date(right.at ?? 0).getTime() - new Date(left.at ?? 0).getTime(),
  )[0];

  return best ?? { label: "No activity", at: null };
};

export const formatLeadActivityFooter = (activity: LeadActivitySummary) => {
  if (!activity.at) return activity.label;
  const date = new Date(activity.at);
  if (Number.isNaN(date.getTime())) return activity.label;

  const age = formatDistanceToNowStrict(date, { addSuffix: false })
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "y")
    .replace(" year", "y");

  return `${activity.label} ${age} ago`;
};

export const isLeadActivityStale = (activityAt?: string | null) => {
  if (!activityAt) return true;
  const date = new Date(activityAt);
  if (Number.isNaN(date.getTime())) return true;
  return differenceInDays(new Date(), date) >= STALE_ACTIVITY_DAYS;
};

export const getLeadInitials = (lead: Contact) =>
  getInitials(getLeadDisplayName(lead));
