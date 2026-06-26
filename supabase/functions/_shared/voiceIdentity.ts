export const buildVoiceClientIdentity = (orgId: number, memberId: number) =>
  `member-${orgId}-${memberId}`;

export const parseVoiceClientIdentity = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  const withoutPrefix = trimmed.startsWith("client:")
    ? trimmed.slice("client:".length)
    : trimmed;
  const match = /^member-(\d+)-(\d+)$/.exec(withoutPrefix);
  if (!match) return null;
  const orgId = Number(match[1]);
  const memberId = Number(match[2]);
  if (!Number.isFinite(orgId) || !Number.isFinite(memberId)) return null;
  return { orgId, memberId };
};
