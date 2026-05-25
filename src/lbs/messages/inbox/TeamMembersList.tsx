import { useMemo, useState } from "react";
import type { Identifier } from "ra-core";
import { useGetIdentity, useGetList, useNotify } from "ra-core";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Conversation, OrganizationMember } from "@/lbs/types";
import { getInitials } from "@/lbs/messages/conversationDisplay";
import { useOpenDirectMessage } from "@/lbs/messages/useDirectMessage";
import { useOrgPresence } from "@/lbs/messages/useOrgPresence";

const TEAM_MEMBERS_PAGE_SIZE = 200;

export type TeamMembersListProps = {
  selectedConversationId?: Identifier;
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => void;
};

/**
 * "Team Members" panel inside the Messages → Team tab.
 *
 * - Lists every active member of the current org (RLS scopes the query).
 * - A green dot indicates an active browser session (Supabase Realtime
 *   Presence — see useOrgPresence).
 * - Clicking a member opens (or creates) a 1:1 DM via useOpenDirectMessage,
 *   then selects the conversation so the right-hand thread renders.
 */
export const TeamMembersList = ({
  selectedConversationId,
  conversations,
  onSelectConversation,
}: TeamMembersListProps) => {
  const { identity } = useGetIdentity();
  const currentMemberId = identity?.id;
  const notify = useNotify();
  const { openDirectMessage } = useOpenDirectMessage();
  const { isOnline } = useOrgPresence();

  const { data: members = [], isPending } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter: { "disabled@eq": false },
      pagination: { page: 1, perPage: TEAM_MEMBERS_PAGE_SIZE },
      sort: { field: "first_name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const [openingMemberId, setOpeningMemberId] = useState<Identifier | null>(
    null,
  );

  const sortedMembers = useMemo(() => {
    const list = members.filter(
      (member) => String(member.id) !== String(currentMemberId),
    );
    return [...list].sort((a, b) => {
      const aOnline = isOnline(a.id) ? 0 : 1;
      const bOnline = isOnline(b.id) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      const aName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
      const bName = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
  }, [currentMemberId, isOnline, members]);

  const dmConversationByMemberId = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const conversation of conversations) {
      if (conversation.type !== "team_dm") continue;
      const key = conversation.dm_key;
      if (!key || currentMemberId == null) continue;
      const [a, b] = String(key).split(":");
      const other = String(currentMemberId) === a ? b : a;
      if (other && !map.has(other)) {
        map.set(other, conversation);
      }
    }
    return map;
  }, [conversations, currentMemberId]);

  const handleSelect = async (member: OrganizationMember) => {
    if (openingMemberId != null) return;

    const existing = dmConversationByMemberId.get(String(member.id));
    if (existing) {
      onSelectConversation(existing);
      return;
    }

    setOpeningMemberId(member.id);
    try {
      const conversation = await openDirectMessage(member);
      onSelectConversation(conversation);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not open direct message",
        { type: "error" },
      );
    } finally {
      setOpeningMemberId(null);
    }
  };

  if (isPending) {
    return (
      <div className="space-y-1 px-3 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (sortedMembers.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        No other team members in your workspace yet.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 px-1.5 pb-2">
      {sortedMembers.map((member) => {
        const fullName =
          `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
          "Team member";
        const role = member.administrator
          ? "Admin"
          : (member.roles?.[0] ?? "User");
        const existingDm = dmConversationByMemberId.get(String(member.id));
        const isSelected =
          existingDm != null &&
          selectedConversationId != null &&
          String(existingDm.id) === String(selectedConversationId);
        const online = isOnline(member.id);
        const opening = String(openingMemberId) === String(member.id);

        return (
          <li key={String(member.id)}>
            <button
              type="button"
              disabled={opening}
              onClick={() => void handleSelect(member)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/40",
                isSelected && "bg-muted/50",
                opening && "opacity-60",
              )}
            >
              <span className="relative inline-flex shrink-0">
                <Avatar className="size-9">
                  <AvatarImage
                    src={
                      typeof member.avatar === "object" &&
                      member.avatar != null &&
                      "src" in member.avatar
                        ? (member.avatar as { src?: string }).src
                        : undefined
                    }
                    alt={fullName}
                  />
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
                    online ? "bg-emerald-500" : "bg-muted-foreground/30",
                  )}
                />
                <span className="sr-only">
                  {online ? "Online" : "Offline"}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {fullName}
                </span>
                <span className="block truncate text-xs text-muted-foreground capitalize">
                  {role}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
