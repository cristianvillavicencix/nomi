import { marked } from "marked";
import type { Content, Style } from "pdfmake/interfaces";

const inlineFromTokens = (
  tokens: marked.Token[] | undefined,
): Content | Content[] | string => {
  if (!tokens?.length) return "";

  const parts: Content[] = [];
  for (const token of tokens) {
    if (token.type === "text") {
      parts.push(token.text);
      continue;
    }
    if (token.type === "strong") {
      parts.push({
        text: inlineFromTokens(token.tokens) as string,
        bold: true,
      });
      continue;
    }
    if (token.type === "em") {
      parts.push({
        text: inlineFromTokens(token.tokens) as string,
        italics: true,
      });
      continue;
    }
    if (token.type === "del") {
      parts.push({
        text: inlineFromTokens(token.tokens) as string,
        decoration: "lineThrough",
      });
      continue;
    }
    if (token.type === "link") {
      const label = inlineFromTokens(token.tokens) as string;
      parts.push(`${label} (${token.href})`);
      continue;
    }
    if (token.type === "codespan") {
      parts.push({ text: token.text, font: "Courier", fontSize: 10 });
    }
  }

  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return parts;
};

const headingStyle = (depth: number): Style => {
  if (depth === 1)
    return {
      fontSize: 14,
      bold: true,
      color: "#0f172a",
      margin: [0, 14, 0, 8],
    };
  if (depth === 2)
    return {
      fontSize: 12,
      bold: true,
      color: "#0f172a",
      margin: [0, 12, 0, 6],
    };
  return { fontSize: 11, bold: true, color: "#334155", margin: [0, 10, 0, 4] };
};

const listItemContent = (item: marked.Tokens.ListItem): Content => {
  if (item.task) {
    const prefix = item.checked ? "☑ " : "☐ ";
    return {
      text: [
        prefix,
        ...(Array.isArray(inlineFromTokens(item.tokens))
          ? (inlineFromTokens(item.tokens) as Content[])
          : [inlineFromTokens(item.tokens) as string]),
      ],
    };
  }
  return { text: inlineFromTokens(item.tokens) };
};

/** Flowing markdown → pdfmake blocks (headings, lists, paragraphs, bold, etc.). */
export const markdownToPdfMakeContent = (markdown: string): Content[] => {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const tokens = marked.lexer(trimmed);
  const content: Content[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      content.push({
        text: token.text,
        ...headingStyle(token.depth),
      });
      continue;
    }

    if (token.type === "paragraph") {
      content.push({
        text: inlineFromTokens(token.tokens),
        fontSize: 11,
        lineHeight: 1.45,
        color: "#334155",
        margin: [0, 0, 0, 8],
      });
      continue;
    }

    if (token.type === "list") {
      const items = token.items.map((item) => listItemContent(item));
      content.push({
        ...(token.ordered ? { ol: items } : { ul: items }),
        fontSize: 11,
        lineHeight: 1.45,
        color: "#334155",
        margin: [0, 0, 0, 10],
      });
      continue;
    }

    if (token.type === "blockquote") {
      content.push({
        stack: markdownToPdfMakeContent(token.text),
        margin: [12, 0, 0, 10],
        color: "#475569",
      });
      continue;
    }

    if (token.type === "code") {
      content.push({
        text: token.text,
        font: "Courier",
        fontSize: 10,
        color: "#334155",
        margin: [0, 0, 0, 10],
        preserveLeadingSpaces: true,
      });
      continue;
    }

    if (token.type === "hr") {
      content.push({
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#e2e8f0",
          },
        ],
        margin: [0, 8, 0, 12],
      });
      continue;
    }

    if (token.type === "space") {
      content.push({ text: " ", margin: [0, 0, 0, 6] });
    }
  }

  return content;
};
