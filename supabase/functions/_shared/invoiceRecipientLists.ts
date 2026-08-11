import { normalizeUsPhoneToE164 } from "./phone.ts";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const splitInvoiceRecipientList = (value: string) =>
  value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const parseInvoiceRecipientEmailList = (value: string): string[] => {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const entry of splitInvoiceRecipientList(value)) {
    const normalized = entry.toLowerCase();
    if (!emailRegex.test(normalized)) {
      throw new Error(`Enter a valid email address: ${entry}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(normalized);
  }
  return emails;
};

export const parseInvoiceRecipientPhoneList = (value: string): string[] => {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const entry of splitInvoiceRecipientList(value)) {
    const normalized = normalizeUsPhoneToE164(entry);
    if (!normalized) {
      throw new Error(`Enter a valid 10-digit US number: ${entry}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    phones.push(normalized);
  }
  return phones;
};
