/** Client-side mirror of edge sanitize (defense in depth). */
export const sanitizeAssistantReply = (raw: string): string => {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return text;

  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");

  const lines = text.split("\n").map((line) => {
    let l = line;
    l = l.replace(/^#{1,6}\s+/g, "");
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) return "";
    l = l.replace(/^[✅⚠️👉❌✔️]\s*/gu, "");
    l = l.replace(/\*\*(.*?)\*\*/g, "$1");
    l = l.replace(/__(.*?)__/g, "$1");
    l = l.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, "$1");
    return l.trimEnd();
  });

  text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = text.replace(/\p{Extended_Pictographic}/gu, "").replace(/ {2,}/g, " ");

  return text.trim();
};
