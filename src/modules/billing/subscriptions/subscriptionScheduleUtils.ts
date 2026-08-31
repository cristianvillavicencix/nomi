import type { ClientSubscription } from "@/modules/types";

export type SubscriptionDurationValue =
  | "ongoing"
  | "3"
  | "6"
  | "12"
  | "custom";

export const SUBSCRIPTION_DURATION_OPTIONS: Array<{
  value: SubscriptionDurationValue;
  label: string;
}> = [
  { value: "ongoing", label: "Ongoing" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "custom", label: "Custom end date" },
];

export type SubscriptionPaymentMode =
  | "saved_card"
  | "staff_card"
  | "request_setup";

export type SubscriptionEnrollmentMode = "direct" | "agreement";

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const parseIsoDateAtStartOfDay = (isoDate: string) => {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return new Date(`${trimmed}T00:00:00`);
};

export const parseIsoDateAtEndOfDay = (isoDate: string) => {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return new Date(`${trimmed}T23:59:59`);
};

export const computeSubscriptionEndsAt = (params: {
  startsAt: Date;
  duration: SubscriptionDurationValue;
  customEndDate?: string | null;
}): Date | null => {
  if (params.duration === "ongoing") return null;
  if (params.duration === "custom") {
    return params.customEndDate
      ? parseIsoDateAtEndOfDay(params.customEndDate)
      : null;
  }
  const months = Number.parseInt(params.duration, 10);
  if (!Number.isFinite(months) || months <= 0) return null;
  const end = new Date(params.startsAt);
  end.setMonth(end.getMonth() + months);
  return end;
};

export const buildStripeScheduleUnixParams = (params: {
  startsAt: Date;
  endsAt?: Date | null;
  now?: Date;
}) => {
  const now = params.now ?? new Date();
  const startMs = params.startsAt.getTime();
  const trialEnd =
    startMs > now.getTime() + 60_000
      ? Math.floor(startMs / 1000)
      : undefined;
  const cancelAt = params.endsAt
    ? Math.floor(params.endsAt.getTime() / 1000)
    : undefined;
  return { trial_end: trialEnd, cancel_at: cancelAt };
};

export const formatSubscriptionScheduleLabel = (params: {
  startsAt?: string | null;
  endsAt?: string | null;
  billingInterval?: string | null;
}) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startDate = params.startsAt?.trim();
  const parsedStart =
    startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? parseIsoDateAtStartOfDay(startDate)
      : startDate
        ? new Date(startDate)
        : null;
  const start =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? formatter.format(parsedStart)
      : "Today";
  const endDate = params.endsAt?.trim();
  const parsedEnd = endDate
    ? /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? parseIsoDateAtEndOfDay(endDate)
      : new Date(endDate)
    : null;
  const end =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? formatter.format(parsedEnd)
      : "Ongoing";
  return { start, end };
};

export const subscriptionPaymentModeLabel = (mode: SubscriptionPaymentMode) => {
  switch (mode) {
    case "saved_card":
      return "Card on file";
    case "staff_card":
      return "Enter manually";
    case "request_setup":
      return "Request from client";
    default:
      return mode;
  }
};

export const resolveDurationFromSubscription = (
  subscription: Pick<ClientSubscription, "ends_at" | "starts_at">,
): { duration: SubscriptionDurationValue; customEndDate: string } => {
  if (!subscription.ends_at) {
    return { duration: "ongoing", customEndDate: "" };
  }
  const endDate = subscription.ends_at.slice(0, 10);
  const startDate = subscription.starts_at?.slice(0, 10) ?? todayIsoDate();
  const start = parseIsoDateAtStartOfDay(startDate);
  if (!start) {
    return { duration: "custom", customEndDate: endDate };
  }

  for (const option of SUBSCRIPTION_DURATION_OPTIONS) {
    if (option.value === "ongoing" || option.value === "custom") continue;
    const computed = computeSubscriptionEndsAt({
      startsAt: start,
      duration: option.value,
      customEndDate: "",
    });
    if (computed && computed.toISOString().slice(0, 10) === endDate) {
      return { duration: option.value, customEndDate: endDate };
    }
  }

  return { duration: "custom", customEndDate: endDate };
};

export const inferSubscriptionPaymentMode = (
  subscription: Pick<
    ClientSubscription,
    "status" | "payment_method_last4" | "stripe_subscription_id"
  >,
): SubscriptionPaymentMode => {
  if (subscription.stripe_subscription_id || subscription.payment_method_last4) {
    return "saved_card";
  }
  if (subscription.status === "pending_setup") {
    return "request_setup";
  }
  return "request_setup";
};
