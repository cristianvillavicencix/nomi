import type { Identifier } from "ra-core";
import type { OrganizationMember, Person, Task } from "@/components/atomic-crm/types";
import { getPersonName } from "@/components/atomic-crm/tasks/taskPeopleOptions";

/** Stored tokens: @[Name](person:42) or @[Name](member:5) */
export const TASK_PERSON_MENTION_REGEX =
  /@\[([^\]]+)\]\(person:(\d+)\)/g;

export const TASK_MEMBER_MENTION_REGEX =
  /@\[([^\]]+)\]\(member:(\d+)\)/g;

export const TASK_ANY_MENTION_REGEX =
  /@\[([^\]]+)\]\((person|member):(\d+)\)/g;

export const buildTaskPersonMentionToken = (
  person: Pick<Person, "id" | "first_name" | "last_name">,
) => `@[${getPersonName(person)}](person:${person.id})`;

export const buildTaskMemberMentionToken = (
  member: Pick<OrganizationMember, "id" | "first_name" | "last_name">,
) => {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Team member";
  return `@[${name}](member:${member.id})`;
};

export const extractMentionPersonIds = (text?: string | null): number[] => {
  if (!text) return [];
  const ids = new Set<number>();
  for (const match of text.matchAll(TASK_PERSON_MENTION_REGEX)) {
    const id = Number(match[2]);
    if (Number.isFinite(id)) ids.add(id);
  }
  return Array.from(ids);
};

export const extractMentionMemberIds = (text?: string | null): number[] => {
  if (!text) return [];
  const ids = new Set<number>();
  for (const match of text.matchAll(TASK_MEMBER_MENTION_REGEX)) {
    const id = Number(match[2]);
    if (Number.isFinite(id)) ids.add(id);
  }
  return Array.from(ids);
};

export const taskTextHasMentionTokens = (text?: string | null) =>
  Boolean(text && /@\[[^\]]+\]\((person|member):\d+\)/.test(text));

export const getMentionQueryAtCursor = (text: string, cursor: number) => {
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex === -1) return null;

  const segment = beforeCursor.slice(atIndex);
  if (segment.includes("](person:") || segment.includes("](member:")) return null;

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

export const insertTaskPersonMention = (
  text: string,
  cursor: number,
  mentionStart: number,
  person: Pick<Person, "id" | "first_name" | "last_name">,
) =>
  insertTaskMentionToken(text, cursor, mentionStart, buildTaskPersonMentionToken(person));

export const insertTaskMemberMention = (
  text: string,
  cursor: number,
  mentionStart: number,
  member: Pick<OrganizationMember, "id" | "first_name" | "last_name">,
) =>
  insertTaskMentionToken(text, cursor, mentionStart, buildTaskMemberMentionToken(member));

export type TaskMentionSegment =
  | { type: "text"; value: string }
  | { type: "person"; name: string; id: Identifier }
  | { type: "member"; name: string; id: Identifier };

export const parseTaskMentionSegments = (text?: string | null): TaskMentionSegment[] => {
  if (!text) return [];

  const segments: TaskMentionSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TASK_ANY_MENTION_REGEX)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }
    segments.push(
      match[2] === "member"
        ? { type: "member", name: match[1], id: match[3] }
        : { type: "person", name: match[1], id: match[3] },
    );
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
  peopleById,
}: {
  assigneePersonIds?: Identifier[];
  collaboratorPersonIds?: Identifier[];
  organizationMember?: Pick<OrganizationMember, "id" | "first_name" | "last_name" | "email"> | null;
  peopleById: Record<string, Person>;
}) => {
  const tokens: string[] = [];
  const seenPeople = new Set<string>();
  const allPersonIds = [...assigneePersonIds, ...collaboratorPersonIds];

  allPersonIds.forEach((personId) => {
    const key = String(personId);
    if (seenPeople.has(key)) return;
    const person = peopleById[key];
    if (!person) return;
    seenPeople.add(key);
    tokens.push(buildTaskPersonMentionToken(person));
  });

  let mentionedMemberIds: number[] = [];

  if (tokens.length === 0 && organizationMember) {
    tokens.push(buildTaskMemberMentionToken(organizationMember));
    mentionedMemberIds = [Number(organizationMember.id)].filter(Number.isFinite);
  }

  return {
    prefix: tokens.join(" "),
    mentionedMemberIds,
  };
};

export const migrateLegacyTaskRecord = (
  task: Task,
  peopleById: Record<string, Person>,
  organizationMember?: OrganizationMember | null,
) => {
  if (taskTextHasMentionTokens(task.text)) return task;

  const { prefix, mentionedMemberIds } = buildLegacyTaskMentionPrefix({
    assigneePersonIds: task.assignee_person_ids,
    collaboratorPersonIds: task.collaborator_person_ids,
    organizationMember:
      organizationMember ??
      (task.organization_member_id != null
        ? ({
            id: task.organization_member_id,
            first_name: "",
            last_name: "",
          } as OrganizationMember)
        : null),
    peopleById,
  });

  if (!prefix) return task;

  const originalText = task.text?.trim() ?? "";
  return {
    ...task,
    text: originalText ? `${prefix} — ${originalText}` : prefix,
    mentioned_member_ids:
      mentionedMemberIds.length > 0
        ? mentionedMemberIds
        : task.mentioned_member_ids ?? [],
  };
};

export const applyMentionIdsToTaskData = (data: Record<string, unknown>) => {
  const text = String(data.text ?? "");
  const personIds = extractMentionPersonIds(text);
  const memberIds = extractMentionMemberIds(text);

  if (personIds.length === 0 && memberIds.length === 0) return data;

  return {
    ...data,
    ...(personIds.length > 0
      ? {
          assignee_person_ids: personIds,
          collaborator_person_ids: [],
        }
      : {}),
    ...(memberIds.length > 0 ? { mentioned_member_ids: memberIds } : {}),
  };
};

// Backward-compatible aliases
export const buildTaskMentionToken = buildTaskPersonMentionToken;
export const insertTaskMention = insertTaskPersonMention;
export const TASK_MENTION_TOKEN_REGEX = TASK_PERSON_MENTION_REGEX;
