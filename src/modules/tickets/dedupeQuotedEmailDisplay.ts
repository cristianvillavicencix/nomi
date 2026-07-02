import { isPlainTextSimilar } from "@/modules/tickets/ticketEmailQuotedContent";

const MIN_DUPLICATE_TEXT_LENGTH = 40;
const MAX_DEDUPE_HTML_LENGTH = 500_000;

const stripAllWhitespace = (text: string) =>
  text.replace(/\s+/g, "").toLowerCase();

const htmlToComparableText = (html: string) =>
  stripAllWhitespace(html.replace(/<[^>]+>/g, " "));

const htmlStructureScore = (html: string) =>
  (html.match(/<br\b|<\/p>|<table\b|<tr\b|<td\b|<li\b/gi) || []).length +
  html.split("\n").length;

const pickRicherDuplicate = (left: string, right: string) => {
  const leftScore = htmlStructureScore(left);
  const rightScore = htmlStructureScore(right);
  return leftScore >= rightScore ? left : right;
};

const pickRicherPlain = (left: string, right: string) => {
  const leftScore =
    left.split("\n").length + (left.match(/[.!?]\s/g) || []).length;
  const rightScore =
    right.split("\n").length + (right.match(/[.!?]\s/g) || []).length;
  return leftScore >= rightScore ? left : right;
};

const isDuplicateText = (left: string, right: string) => {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  return (
    shorter.length >= MIN_DUPLICATE_TEXT_LENGTH && longer.includes(shorter)
  );
};

const blocksAreDuplicates = (left: string, right: string) =>
  isDuplicateText(htmlToComparableText(left), htmlToComparableText(right)) ||
  isPlainTextSimilar(
    left.replace(/<[^>]+>/g, " "),
    right.replace(/<[^>]+>/g, " "),
  );

export const hasRepeatedPlainContent = (text: string) => {
  const normalized = stripAllWhitespace(text);
  if (normalized.length < 120) return false;

  for (const windowSize of [72, 60, 48, 40, 32]) {
    if (normalized.length < windowSize * 2) continue;
    const maxStart = Math.min(240, normalized.length - windowSize);
    for (let start = 0; start <= maxStart; start += 8) {
      const needle = normalized.slice(start, start + windowSize);
      if (needle.length < 24) continue;
      const second = normalized.indexOf(needle, start + needle.length);
      if (second > 0 && second < normalized.length * 0.9) return true;
    }
  }

  const greetingMatch = normalized.match(
    /(?:hola|hello|hi|dear|estimad|buenos|good morning|good afternoon)[a-z0-9]*/,
  );
  if (greetingMatch?.index !== undefined) {
    const greetingStart = greetingMatch.index;
    const greetingNeedle = normalized.slice(greetingStart, greetingStart + 48);
    if (greetingNeedle.length >= 24) {
      const second = normalized.indexOf(
        greetingNeedle,
        greetingStart + greetingNeedle.length,
      );
      if (second > 0) return true;
    }
  }

  const midpoint = Math.floor(normalized.length / 2);
  return isDuplicateText(
    normalized.slice(0, midpoint),
    normalized.slice(midpoint),
  );
};

const isStructuredBlock = (element: HTMLElement) =>
  /<(?:p|table|tr|td|li|tbody|thead|img)\b/i.test(element.innerHTML) ||
  (element.innerHTML.match(/<br\b/gi) || []).length >= 2;

const isLowStructureBlock = (element: HTMLElement) =>
  !isStructuredBlock(element) &&
  htmlToComparableText(element.innerHTML).length >= MIN_DUPLICATE_TEXT_LENGTH;

const tryMergeDuplicateHalves = (text: string) => {
  const normalized = stripAllWhitespace(text);
  if (hasRepeatedPlainContent(normalized)) {
    const greetingMatch = normalized.match(
      /(?:hola|hello|hi|dear|estimad)[a-z0-9]*/,
    );
    if (greetingMatch?.index !== undefined) {
      const greetingStart = greetingMatch.index;
      const greetingNeedle = normalized.slice(greetingStart, greetingStart + 48);
      const second = normalized.indexOf(
        greetingNeedle,
        greetingStart + greetingNeedle.length,
      );
      if (second > greetingStart) {
        const ratio = second / normalized.length;
        const splitAt = Math.floor(text.length * ratio);
        const right = text.slice(splitAt).trim();
        const left = text.slice(0, splitAt).trim();
        if (right) return pickRicherPlain(left, right);
      }
    }
  }

  const pivot = text.search(/\n{2,}/);
  if (pivot === -1) return text;

  const left = text.slice(0, pivot).trim();
  const right = text.slice(pivot).trim();
  if (
    left.length >= MIN_DUPLICATE_TEXT_LENGTH &&
    right.length >= MIN_DUPLICATE_TEXT_LENGTH &&
    isDuplicateText(stripAllWhitespace(left), stripAllWhitespace(right))
  ) {
    return pickRicherPlain(left, right);
  }

  return text;
};

const dedupeComparableParts = (
  parts: string[],
  toComparable: (part: string) => string,
) => {
  const unique: string[] = [];

  for (const part of parts) {
    const comparable = toComparable(part);
    const existingIndex = unique.findIndex((existing) =>
      isDuplicateText(toComparable(existing), comparable),
    );

    if (existingIndex === -1) {
      unique.push(part);
      continue;
    }

    unique[existingIndex] = pickRicherDuplicate(unique[existingIndex], part);
  }

  return unique;
};

const dedupeQuotedHtmlHeuristic = (html: string) => {
  const parts = html
    .split(/(?=<(?:div|blockquote|p)\b)/i)
    .filter((part) => part.trim());
  if (parts.length < 2) return html;
  return dedupeComparableParts(parts, htmlToComparableText).join("");
};

const isQuoteMetaElement = (element: HTMLElement) =>
  element.classList.contains("gmail_attr") ||
  element.classList.contains("gmail_signature") ||
  /^On .+wrote:$/i.test((element.textContent || "").trim()) ||
  /^El .+escribi[oó]:/i.test((element.textContent || "").trim());

type ComparableBlock = {
  node: Node;
  comparableHtml: string;
};

const blockComparableHtml = (node: Node) => {
  if (node instanceof HTMLElement) return node.outerHTML;
  return node.textContent || "";
};

const getComparableChildBlocks = (container: ParentNode): ComparableBlock[] => {
  const blocks: ComparableBlock[] = [];

  for (const node of Array.from(container.childNodes)) {
    if (node instanceof HTMLElement) {
      if (isQuoteMetaElement(node)) continue;
      const comparableHtml = blockComparableHtml(node);
      if (
        htmlToComparableText(comparableHtml).length >= MIN_DUPLICATE_TEXT_LENGTH
      ) {
        blocks.push({ node, comparableHtml });
      }
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = stripAllWhitespace(node.textContent || "");
      if (text.length >= MIN_DUPLICATE_TEXT_LENGTH) {
        blocks.push({ node, comparableHtml: node.textContent || "" });
      }
    }
  }

  return blocks;
};

const pruneRedundantTextNodes = (
  container: ParentNode,
  structuredText: string,
) => {
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = stripAllWhitespace(node.textContent || "");
    if (text.length >= MIN_DUPLICATE_TEXT_LENGTH) {
      if (isDuplicateText(text, structuredText)) {
        node.remove();
      }
    }
  }
};

const removeDuplicateSiblingBlocks = (container: ParentNode) => {
  let changed = true;

  while (changed) {
    changed = false;
    const blocks = getComparableChildBlocks(container);
    if (blocks.length < 2) return;

    for (let index = 0; index < blocks.length; index += 1) {
      for (let other = index + 1; other < blocks.length; other += 1) {
        const first = blocks[index];
        const second = blocks[other];
        if (!first?.node.isConnected || !second?.node.isConnected) continue;

        if (
          blocksAreDuplicates(first.comparableHtml, second.comparableHtml)
        ) {
          const keeper = pickRicherDuplicate(
            first.comparableHtml,
            second.comparableHtml,
          );
          if (keeper === first.comparableHtml) {
            second.node.remove();
          } else {
            first.node.remove();
          }
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
};

const collectElements = (root: ParentNode) => {
  const elements: HTMLElement[] = [];
  const queue: ParentNode[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const child of Array.from(current.childNodes)) {
      if (child instanceof HTMLElement) {
        elements.push(child);
        queue.push(child);
      }
    }
  }

  return elements;
};

const pruneNestedPlainDuplicates = (root: ParentNode) => {
  const elements = collectElements(root);
  const structured = elements.filter(isStructuredBlock);

  for (const element of elements) {
    if (!element.isConnected || isQuoteMetaElement(element)) continue;
    if (!isLowStructureBlock(element)) continue;

    const text = stripAllWhitespace(element.textContent || "");
    if (text.length < MIN_DUPLICATE_TEXT_LENGTH) continue;

    for (const rich of structured) {
      if (!rich.isConnected || rich === element) continue;

      const richText = stripAllWhitespace(rich.textContent || "");
      if (rich.contains(element)) {
        if (isDuplicateText(text, richText)) {
          element.remove();
        }
        break;
      }

      if (element.contains(rich)) continue;

      if (blocksAreDuplicates(text, richText)) {
        element.remove();
        break;
      }
    }
  }

  for (const rich of structured) {
    if (!rich.isConnected) continue;
    const richText = stripAllWhitespace(rich.textContent || "");
    let parent = rich.parentElement;
    while (parent && parent !== root && parent instanceof HTMLElement) {
      pruneRedundantTextNodes(parent, richText);
      parent = parent.parentElement;
    }
  }
};

const appendMissingRichTailFromOriginal = (
  originalHtml: string,
  dedupedHtml: string,
) => {
  const originalDoc = parseQuotedHtml(originalHtml);
  const dedupedDoc = parseQuotedHtml(dedupedHtml);
  if (!originalDoc || !dedupedDoc) return dedupedHtml;

  const dedupedComparable = htmlToComparableText(dedupedHtml);
  const tailNodes = [...originalDoc.body.querySelectorAll("table, img")].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  if (!tailNodes.length) return dedupedHtml;

  const missing = tailNodes.filter((node) => {
    const nodeText = htmlToComparableText(node.outerHTML);
    if (nodeText.length >= MIN_DUPLICATE_TEXT_LENGTH) {
      return !isDuplicateText(nodeText, dedupedComparable);
    }

    const src =
      node instanceof HTMLImageElement
        ? node.getAttribute("src")
        : node.querySelector("img")?.getAttribute("src");
    return Boolean(src && !dedupedHtml.includes(src));
  });

  if (!missing.length) return dedupedHtml;

  const tailHtml = missing
    .map((node) => node.outerHTML)
    .join("");

  return `${dedupedHtml}${tailHtml}`;
};

const pruneDuplicateBlocksDeep = (root: ParentNode) => {
  const queue: ParentNode[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    removeDuplicateSiblingBlocks(current);

    for (const child of Array.from(current.childNodes)) {
      if (child instanceof HTMLElement) {
        queue.push(child);
      }
    }
  }

  pruneNestedPlainDuplicates(root);
};

const parseQuotedHtml = (html: string) => {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
};

export const dedupeQuotedHtmlForDisplay = (html: string) => {
  const trimmed = html.trim();
  if (!trimmed || trimmed.length > MAX_DEDUPE_HTML_LENGTH) return trimmed;

  const doc = parseQuotedHtml(trimmed);
  if (!doc) return dedupeQuotedHtmlHeuristic(trimmed);

  pruneDuplicateBlocksDeep(doc.body);
  let result = doc.body.innerHTML.trim() || trimmed;
  result = appendMissingRichTailFromOriginal(trimmed, result);

  return dedupeQuotedHtmlHeuristic(result);
};

export const dedupeQuotedPlainForDisplay = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const mergedHalves = tryMergeDuplicateHalves(trimmed);
  if (mergedHalves !== trimmed) return mergedHalves;

  const parts = trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return trimmed;

  return dedupeComparableParts(parts, stripAllWhitespace).join("\n\n");
};

export const stripTrailingDuplicateOfQuoted = (
  content: string,
  quoted: string,
  isHtml = false,
) => {
  const trimmedContent = content.trim();
  const trimmedQuoted = quoted.trim();
  if (!trimmedContent || !trimmedQuoted) return trimmedContent;

  const quotedText = isHtml
    ? htmlToComparableText(trimmedQuoted)
    : stripAllWhitespace(trimmedQuoted);
  if (quotedText.length < MIN_DUPLICATE_TEXT_LENGTH) return trimmedContent;

  const trailingMatchesQuoted = (trailing: string) => {
    if (trailing.length < MIN_DUPLICATE_TEXT_LENGTH) return false;
    return (
      isDuplicateText(trailing, quotedText) ||
      quotedText.startsWith(trailing) ||
      trailing.startsWith(
        quotedText.slice(0, Math.min(quotedText.length, trailing.length)),
      )
    );
  };

  if (isHtml) {
    const doc = parseQuotedHtml(trimmedContent);
    if (doc) {
      const blocks = getComparableChildBlocks(doc.body);
      const lastBlock = blocks.at(-1);
      if (lastBlock) {
        const trailing = htmlToComparableText(lastBlock.comparableHtml);
        if (trailingMatchesQuoted(trailing)) {
          lastBlock.node.remove();
          return doc.body.innerHTML.trim() || trimmedContent;
        }
      }
    } else {
      const divParts = trimmedContent
        .split(/(?=<div\b)/i)
        .filter((part) => part.trim());
      const lastPart = divParts.at(-1);
      if (lastPart && divParts.length > 1) {
        const trailing = htmlToComparableText(lastPart);
        if (trailingMatchesQuoted(trailing)) {
          return divParts.slice(0, -1).join("").trim();
        }
      }
    }
  }

  const parts = trimmedContent.split(/\n{2,}/).map((part) => part.trim());
  const lastPart = parts.at(-1);
  if (lastPart && trailingMatchesQuoted(stripAllWhitespace(lastPart))) {
    return parts.slice(0, -1).join("\n\n").trim();
  }

  return trimmedContent;
};
