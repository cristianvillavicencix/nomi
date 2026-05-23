import type { OrganizationMember, Person } from "@/components/atomic-crm/types";
import { getPersonName } from "@/components/atomic-crm/tasks/taskPeopleOptions";
import {
  type TaskMentionSegment,
  parseTaskMentionSegments,
  taskTextHasMentionTokens,
} from "@/components/atomic-crm/tasks/taskMentions";

export const MENTION_SPAN_SELECTOR = "[data-mention-type][data-mention-id]";

export const createMentionSpan = (
  type: "person" | "member",
  id: string | number,
  name: string,
) => {
  const span = document.createElement("span");
  span.dataset.mentionType = type;
  span.dataset.mentionId = String(id);
  span.dataset.mentionName = name;
  span.contentEditable = "false";
  span.className = "font-semibold text-foreground";
  span.textContent = `@${name}`;
  return span;
};

const appendTextWithLineBreaks = (
  parent: DocumentFragment | HTMLElement,
  text: string,
) => {
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (part) {
      parent.appendChild(document.createTextNode(part));
    }
    if (index < parts.length - 1) {
      parent.appendChild(document.createElement("br"));
    }
  });
};

const appendSegment = (
  parent: DocumentFragment,
  segment: TaskMentionSegment,
) => {
  if (segment.type === "text") {
    appendTextWithLineBreaks(parent, segment.value);
    return;
  }

  parent.appendChild(createMentionSpan(segment.type, segment.id, segment.name));
};

export const renderTaskMentionEditorContent = (
  root: HTMLElement,
  text?: string | null,
) => {
  root.innerHTML = "";
  if (!text) return;

  const fragment = document.createDocumentFragment();
  parseTaskMentionSegments(text).forEach((segment) =>
    appendSegment(fragment, segment),
  );
  root.appendChild(fragment);
};

export const serializeTaskMentionEditor = (root: HTMLElement): string => {
  const clone = root.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(MENTION_SPAN_SELECTOR).forEach((node) => {
    const span = node as HTMLElement;
    const token = `@[${span.dataset.mentionName}](${span.dataset.mentionType}:${span.dataset.mentionId})`;
    span.replaceWith(document.createTextNode(token));
  });

  return clone.innerText.replace(/\u00A0/g, " ");
};

const createRangeFromCharacterOffsets = (
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
): Range | null => {
  const range = document.createRange();
  let offset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (!startNode && offset + length >= startOffset) {
        startNode = node;
        startNodeOffset = startOffset - offset;
      }
      if (!endNode && offset + length >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - offset;
        return true;
      }
      offset += length;
      return false;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const element = node as HTMLElement;
    if (element.dataset.mentionType && element.dataset.mentionName) {
      const length = `@${element.dataset.mentionName}`.length;
      if (!startNode && offset + length >= startOffset) {
        startNode = element;
        startNodeOffset = 0;
      }
      if (!endNode && offset + length >= endOffset) {
        endNode = element;
        endNodeOffset = element.childNodes.length;
        return true;
      }
      offset += length;
      return false;
    }

    if (element.tagName === "BR") {
      if (!startNode && offset + 1 >= startOffset) {
        startNode = element;
        startNodeOffset = 0;
      }
      if (!endNode && offset + 1 >= endOffset) {
        endNode = element;
        endNodeOffset = 0;
        return true;
      }
      offset += 1;
      return false;
    }

    const children = Array.from(element.childNodes);
    for (let index = 0; index < children.length; index += 1) {
      if (visit(children[index])) return true;
      const next = children[index + 1];
      if (
        element !== root &&
        (element.tagName === "DIV" || element.tagName === "P") &&
        next &&
        (next as HTMLElement).tagName !== "BR"
      ) {
        if (!startNode && offset + 1 >= startOffset) {
          startNode = element;
          startNodeOffset = element.childNodes.length;
        }
        if (!endNode && offset + 1 >= endOffset) {
          endNode = element;
          endNodeOffset = element.childNodes.length;
          return true;
        }
        offset += 1;
      }
    }

    return false;
  };

  const topLevel = Array.from(root.childNodes);
  for (let index = 0; index < topLevel.length; index += 1) {
    if (visit(topLevel[index])) break;
    const next = topLevel[index + 1];
    if (
      next &&
      topLevel[index].nodeType === Node.ELEMENT_NODE &&
      next.nodeType === Node.ELEMENT_NODE
    ) {
      const leftTag = (topLevel[index] as HTMLElement).tagName;
      const rightTag = (next as HTMLElement).tagName;
      if (
        (leftTag === "DIV" || leftTag === "P") &&
        (rightTag === "DIV" || rightTag === "P")
      ) {
        if (!startNode && offset + 1 >= startOffset) {
          startNode = topLevel[index];
          startNodeOffset = (topLevel[index] as HTMLElement).childNodes.length;
        }
        if (!endNode && offset + 1 >= endOffset) {
          endNode = next;
          endNodeOffset = 0;
          break;
        }
        offset += 1;
      }
    }
  }

  if (!startNode || !endNode) return null;

  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
};

export const findActiveMentionInEditor = (
  root: HTMLElement,
): { query: string; range: Range } | null => {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;

  const cursor = selection.getRangeAt(0);
  if (!root.contains(cursor.startContainer)) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(cursor.startContainer, cursor.startOffset);
  const textBefore = preRange.toString();

  const atIndex = textBefore.lastIndexOf("@");
  if (atIndex === -1) return null;

  const query = textBefore.slice(atIndex + 1);
  if (!query || query.includes("\n") || query.includes(" ")) return null;

  const mentionRange = createRangeFromCharacterOffsets(
    root,
    atIndex,
    textBefore.length,
  );
  if (!mentionRange) return null;

  return { query, range: mentionRange };
};

export const insertMentionInEditor = (
  mentionRange: Range,
  type: "person" | "member",
  id: string | number,
  name: string,
) => {
  mentionRange.deleteContents();
  const span = createMentionSpan(type, id, name);
  mentionRange.insertNode(span);

  const space = document.createTextNode(" ");
  span.after(space);

  const selection = window.getSelection();
  const nextRange = document.createRange();
  nextRange.setStartAfter(space);
  nextRange.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(nextRange);
};

export const insertTaskPersonMentionInEditor = (
  mentionRange: Range,
  person: Pick<Person, "id" | "first_name" | "last_name">,
) =>
  insertMentionInEditor(
    mentionRange,
    "person",
    person.id,
    getPersonName(person),
  );

export const insertTaskMemberMentionInEditor = (
  mentionRange: Range,
  member: Pick<OrganizationMember, "id" | "first_name" | "last_name">,
) => {
  const name =
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Team member";
  return insertMentionInEditor(mentionRange, "member", member.id, name);
};

export const taskMentionEditorHasTokenSyntax = (text?: string | null) =>
  taskTextHasMentionTokens(text);
