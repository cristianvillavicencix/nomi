/** Strip decorative markdown the model sometimes still emits. */
export const sanitizeAssistantReply = (raw: string): string => {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return text;

  // Remove fenced code blocks wrappers but keep inner text.
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");

  const lines = text.split("\n").map((line) => {
    let l = line;
    // Headings
    l = l.replace(/^#{1,6}\s+/g, "");
    // Horizontal rules
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) return "";
    // Leading checkbox / emoji-ish markers
    l = l.replace(/^[✅⚠️👉❌✔️]\s*/gu, "");
    // Bold / italic markers
    l = l.replace(/\*\*(.*?)\*\*/g, "$1");
    l = l.replace(/__(.*?)__/g, "$1");
    l = l.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, "$1");
    return l.trimEnd();
  });

  text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Drop leftover emoji pictographs (keep normal punctuation).
  text = text.replace(/\p{Extended_Pictographic}/gu, "").replace(/ {2,}/g, " ");

  return text.trim();
};
