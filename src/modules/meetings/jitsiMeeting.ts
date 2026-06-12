export const getJitsiBaseUrl = () =>
  (import.meta.env.VITE_JITSI_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) || "https://meet.jit.si";

const slugifyRoomSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "meeting";

export const createMeetingLinkSeed = () =>
  Math.random().toString(36).slice(2, 6);

export const buildJitsiRoomSlug = (params: {
  title?: string | null;
  seed?: string | null;
}) => {
  const titleSlug = slugifyRoomSegment(params.title ?? "meeting");
  const seed = String(params.seed ?? createMeetingLinkSeed()).slice(0, 4);
  return `${titleSlug}-${seed}`;
};

export const buildJitsiMeetingUrl = (roomSlug: string) =>
  `${getJitsiBaseUrl()}/${encodeURIComponent(roomSlug)}`;

export const generateJitsiMeetingUrl = (params: {
  title?: string | null;
  seed?: string | null;
}) => buildJitsiMeetingUrl(buildJitsiRoomSlug(params));

export const getMeetingRoomLabel = (meetingUrl?: string | null) => {
  if (!meetingUrl?.trim()) return "";
  try {
    const path = new URL(meetingUrl).pathname.replace(/^\/+/, "");
    return decodeURIComponent(path);
  } catch {
    return meetingUrl;
  }
};

export const getMeetingLinkSeedFromUrl = (meetingUrl?: string | null) => {
  const room = getMeetingRoomLabel(meetingUrl);
  if (!room) return "";
  const parts = room.split("-");
  const seed = parts[parts.length - 1] ?? "";
  return /^[a-z0-9]{4}$/i.test(seed) ? seed : "";
};
