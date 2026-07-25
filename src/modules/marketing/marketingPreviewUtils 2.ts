import { SMS_MAX_BODY_CHARS } from "@/modules/marketing/smsLimits";

export const SMS_STOP_FOOTER = "Reply STOP to opt out.";

export const appendSmsStopFooter = (body: string): string => {
  const trimmed = body.trim();
  if (/reply\s+stop/i.test(trimmed)) return trimmed;
  return `${trimmed}\n\n${SMS_STOP_FOOTER}`;
};

export const getSmsSegmentInfo = (body: string) => {
  const length = body.length;
  const singleSegment = 160;
  const multiSegment = 153;
  const segments =
    length === 0
      ? 0
      : length <= singleSegment
        ? 1
        : Math.ceil(length / multiSegment);
  return { length, segments, max: SMS_MAX_BODY_CHARS };
};

export const textToMarketingEmailHtml = (text: string) => {
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;">${p
          .split("\n")
          .map((line) =>
            line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;"),
          )
          .join("<br/>")}</p>`,
    )
    .join("");
};
