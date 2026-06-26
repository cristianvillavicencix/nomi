export const applyTextareaWrap = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
  placeholder = "text",
) => {
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const next =
    value.slice(0, selectionStart) +
    before +
    selected +
    after +
    value.slice(selectionEnd);
  const cursor =
    selectionStart + before.length + selected.length + after.length;
  return { next, selectionStart: cursor, selectionEnd: cursor };
};

export const applyTextareaLinePrefix = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
) => {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, index) => {
      if (!line.trim()) return line;
      if (prefix === "1. ")
        return `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`;
      if (line.startsWith(prefix)) return line;
      return `${prefix}${line}`;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(end);
  return {
    next,
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  };
};

export const applyTextareaLink = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const selected = value.slice(selectionStart, selectionEnd).trim() || "link";
  const url = "https://";
  const snippet = `${selected}: ${url}`;
  const next =
    value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const urlStart = selectionStart + selected.length + 2;
  return {
    next,
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  };
};
