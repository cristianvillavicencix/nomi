export const formatBookingTimeLabel = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
};

export const formatBookingDateLabel = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const formatBookingDateLong = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

export const resolveBookingShareUrl = (
  result: { url: string; short_url?: string },
  origin: string,
) => {
  if (result.short_url) {
    return result.short_url.startsWith("http")
      ? result.short_url
      : `${origin}${result.short_url}`;
  }
  return result.url.startsWith("http") ? result.url : `${origin}${result.url}`;
};
