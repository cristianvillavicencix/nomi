const storageKey = (dealId: string | number) => `lbs-brief-form-sent-${dealId}`;

export type BriefFormSentRecord = {
  sentAt: string;
};

export const markBriefFormSent = (dealId: string | number) => {
  const record: BriefFormSentRecord = { sentAt: new Date().toISOString() };
  localStorage.setItem(storageKey(dealId), JSON.stringify(record));
  return record;
};

export const getBriefFormSent = (
  dealId: string | number,
): BriefFormSentRecord | null => {
  try {
    const raw = localStorage.getItem(storageKey(dealId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BriefFormSentRecord;
    return parsed?.sentAt ? parsed : null;
  } catch {
    return null;
  }
};
