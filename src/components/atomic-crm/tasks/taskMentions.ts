import type { Identifier } from "ra-core";
import type { OrganizationMember, Task } from "@/components/atomic-crm/types";
import { getMemberName } from "@/components/atomic-crm/tasks/taskMemberOptions";

/** Legacy stored tokens: @[Name](person:42) — treated as member ids during display. */
export const TASK_PERSON_MENTION_REGEX = /@\[([^\]]+)\]\(person:(\d+)\)/g;

export const TASK_MEMBER_MENTION_REGEX = /@\[([^\]]+)\]\(member:(\d+)\)/g;

export const TASK_ANY_MENTION_REGEX = /@\[([^\]]+)\]\((person|member):(\d+)\)/g;

export const buildTaskMemberMentionToken = (
  member: Pick<OrganizationMember, "id" | "first_name" | "last_name" | "email">,
) => `@[${getMemberName(member)}](member:${member.id})`;

/** @deprecated Legacy alias — new mentions use member tokens. */
export const buildTaskPersonMentionToken = buildTaskMemberMentionToken;

export const extractMentionMemberIds = (text?: string | null): number[] => {
  if (!text) return [];
  const ids = new Set<number>();
  for (const match of text.matchAll(TASK_MEMBER_MENTION_REGEX)) {
    const id = Number(match[2]);
    if (Number.isFinite(id)) ids.add(id);
  }
  for (const match of text.matchAll(TASK_PERSON_MENTION_REGEX)) {
    const id = Number(match[2]);
    if (Number.isFinite(id)) ids.add(id);
  }
  return Array.from(ids);
};

/** @deprecated Legacy alias — person tokens are member ids now. */
export const extractMentionPersonIds = extractMentionMemberIds;

export const taskTextHasMentionTokens = (text?: string | null) =>
  Boolean(text && /@\[[^\]]+\]\((person|member):\d+\)/.test(text));

export const getMentionQueryAtCursor = (text: string, cursor: number) => {
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex === -1) return null;

  const segment = beforeCursor.slice(atIndex);
  if (segment.includes("](person:") || segment.includes("](member:"))
    return null;

  const rawQuery = beforeCursor.slice(atIndex + 1);
  if (rawQuery.includes("\n") || rawQuery.includes(" ")) return null;

  return { start: atIndex, query: rawQuery };
};

export const insertTaskMentionToken = (
  text: string,
  cursor: number,
  mentionStart: number,
  token: string,
) => {
  const before = text.slice(0, mentionStart);
  const after = text.slice(cursor);
  const nextText = `${before}${token} `;
  const nextCursor = nextText.length;
  return { text: `${nextText}${after}`, cursor: nextCursor };
};

export const insertTaskMemberMention = (
  text: string,
  cursor: number,
  mentionStart: number,
  member: Pick<OrganizationMember, "id" | "first_name" | "last_name" | "email">,
) =>
  insertTaskMentionToken(
    text,
    cursor,
    mentionStart,
    buildTaskMemberMentionToken(member),
  );

/** @deprecated Legacy alias */
export const insertTaskPersonMention = insertTaskMemberMention;

export type TaskMentionSegment =
  | { type: "text"; value: string }
  | { type: "member"; name: string; id: Identifier };

export const parseTaskMentionSegments = (
  text?: string | null,
): TaskMentionSegment[] => {
  if (!text) return [];

  const segments: TaskMentionSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TASK_ANY_MENTION_REGEX)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }
    segments.push({ type: "member", name: match[1], id: match[3] });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
};

export const buildLegacyTaskMentionPrefix = ({
  assigneePersonIds = [],
  collaboratorPersonIds = [],
  organizationMember,
  membersById,
}: {
  assigneePersonIds?: Identifier[];
  collaboratorPersonIds?: Identifier[];
  organizationMember?: Pick<
    OrganizationMember,
    "id" | "first_name" | "last_name" | "email"
  > | null;
  membersById: Record<string, OrganizationMember>;
}) => {
  const tokens: string[] = [];
  const seenMembers = new Set<string>();
  const allMemberIds = [...assigneePersonIds, ...collaboratorPersonIds];

  allMemberIds.forEach((memberId) => {
    const key = String(memberId);
    if (seenMembers.has(key)) return;
    const member = membersById[key];
    if (!member) return;
    seenMembers.add(key);
    tokens.push(buildTaskMemberMentionToken(member));
  });

  let mentionedMemberIds: number[] = [];

  if (tokens.length === 0 && organizationMember) {
    tokens.push(buildTaskMemberMentionToken(organizationMember));
    mentionedMemberIds = [Number(organizationMember.id)].filter(
      Number.isFinite,
    );
  }

  return {
    prefix: tokens.join(" "),
    mentionedMemberIds,
  };
};

export const migrateLegacyTaskRecord = (
  task: Task,
  membersById: Record<string, OrganizationMember>,
  organizationMember?: OrganizationMember | null,
) => {
  if (taskTextHasMentionTokens(task.text)) return task;

  const { prefix, mentionedMemberIds } = buildLegacyTaskMentionPrefix({
    assigneePersonIds: task.assignee_person_ids,
    collaboratorPersonIds: task.collaborator_person_ids,
    organizationMember:
      organizationMember ??
      (task.organization_member_id != null
        ? membersById[String(task.organization_member_id)]
        : null),
    membersById,
  });

  if (!prefix) return task;

  const originalText = task.text?.trim() ?? "";
  return {
    ...task,
    text: originalText ? `${prefix} — ${originalText}` : prefix,
    mentioned_member_ids:
      mentionedMemberIds.length > 0
        ? mentionedMemberIds
        : (task.mentioned_member_ids ?? []),
  };
};

export const applyMentionIdsToTaskData = (data: Record<string, unknown>) => {
  const text = String(data.text ?? "");
  const memberIds = extractMentionMemberIds(text);

  if (memberIds.length === 0) return data;

  return {
    ...data,
    assignee_person_ids: memberIds,
    collaborator_person_ids: [],
    mentioned_member_ids: memberIds,
  };
};

export const buildTaskMentionToken = buildTaskMemberMentionToken;
export const insertTaskMention = insertTaskMemberMention;
export const TASK_MENTION_TOKEN_REGEX = TASK_MEMBER_MENTION_REGEX;
