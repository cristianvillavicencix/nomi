import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  buildDeliverablePricingLine,
  type DeliverableBillingKind,
} from "./supplementPricing.ts";

const STATUS_CHANGE_RE = /\*\*Status:\*\*\s*(\w+)\s*→\s*(\w+)/i;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

const formatNoteDate = (iso?: string | null) => {
  if (!iso?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
};

const formatDuration = (ms: number) => {
  const safe = Math.max(0, ms);
  const totalMinutes = Math.floor(safe / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
};

const deliverableShortLabel = (item: {
  billing_kind?: string | null;
  billing_line_count?: number | null;
}) => {
  if (!item.billing_kind) return "Billing not set";
  if (item.billing_kind === "supplement") {
    return `Supplement · ${item.billing_line_count ?? 0} lines`;
  }
  const labels: Record<string, string> = {
    roof: "Roof measurements",
    siding: "Siding measurements",
    esx: "ESX",
    pdf_analysis: "PDF analysis",
  };
  return labels[item.billing_kind] ?? item.billing_kind.replace(/_/g, " ");
};

const formatSmsNote = (params: {
  smsTo?: string | null;
  smsSent?: boolean;
  smsSkipped?: boolean;
}) => {
  const phone = params.smsTo?.trim();
  if (!phone) return "Not sent";
  if (params.smsSent) return `Sent to ${phone}`;
  if (params.smsSkipped) return `Not sent — SMS not configured (${phone})`;
  return `Not sent — ${phone}`;
};

type StatusSegment = {
  status: string;
  startMs: number;
  endMs: number;
};

const computeStatusSegments = (params: {
  ticketCreatedAt: string;
  sentAt: string;
  messages: Array<{ body: string; created_at: string }>;
  firstActivityAt?: string | null;
}): StatusSegment[] => {
  const sentMs = new Date(params.sentAt).getTime();
  const createdMs = new Date(params.ticketCreatedAt).getTime();
  const firstActivityMs = params.firstActivityAt
    ? new Date(params.firstActivityAt).getTime()
    : null;

  const transitions: Array<{ atMs: number; status: string }> = [
    { atMs: createdMs, status: "new" },
  ];

  for (const message of params.messages) {
    const match = message.body.match(STATUS_CHANGE_RE);
    if (!match) continue;
    transitions.push({
      atMs: new Date(message.created_at).getTime(),
      status: match[2].toLowerCase(),
    });
  }

  transitions.push({ atMs: sentMs, status: "waiting" });

  const segments: StatusSegment[] = [];
  for (let i = 0; i < transitions.length - 1; i += 1) {
    const start = transitions[i];
    const end = transitions[i + 1];
    if (end.atMs <= start.atMs) continue;
    segments.push({
      status: start.status,
      startMs: start.atMs,
      endMs: end.atMs,
    });
  }

  if (segments.length === 0 && firstActivityMs) {
    return [
      {
        status: "new",
        startMs: createdMs,
        endMs: Math.max(firstActivityMs, createdMs),
      },
      {
        status: "open",
        startMs: Math.max(firstActivityMs, createdMs),
        endMs: sentMs,
      },
    ];
  }

  if (segments.length === 0) {
    return [
      {
        status: "open",
        startMs: createdMs,
        endMs: sentMs,
      },
    ];
  }

  return segments;
};

export type TicketInvoiceSentNoteContext = {
  invoiceNumber: string;
  amountFormatted: string;
  dueDate?: string | null;
  recipientEmail: string;
  propertyAddress?: string | null;
  senderName: string;
  fromEmail: string;
  smsTo?: string | null;
  smsSent?: boolean;
  smsSkipped?: boolean;
  ticketCreatedAt: string;
  sentAt: string;
  deliverables: Array<{
    title: string;
    billing_kind?: string | null;
    billing_line_count?: number | null;
    created_at?: string | null;
  }>;
  messages: Array<{
    body: string;
    created_at: string;
    direction?: string | null;
  }>;
};

export const buildTicketInvoiceSentInternalNoteBody = (
  params: TicketInvoiceSentNoteContext,
) => {
  const dueDate = formatNoteDate(params.dueDate);
  const sentMs = new Date(params.sentAt).getTime();
  const createdMs = new Date(params.ticketCreatedAt).getTime();
  const turnaroundMs = sentMs - createdMs;

  const deliverableTimes = params.deliverables
    .map((item) => item.created_at)
    .filter(Boolean) as string[];
  const messageTimes = params.messages.map((item) => item.created_at);
  const firstActivityCandidates = [...deliverableTimes, ...messageTimes].sort();
  const firstActivityAt = firstActivityCandidates[0] ?? null;
  const lastDeliverableAt = deliverableTimes.sort().at(-1) ?? firstActivityAt;

  const statusSegments = computeStatusSegments({
    ticketCreatedAt: params.ticketCreatedAt,
    sentAt: params.sentAt,
    messages: params.messages,
    firstActivityAt,
  });

  const statusLines = ["new", "open", "waiting"].map((status) => {
    const segment = statusSegments.find((row) => row.status === status);
    if (!segment)
      return `- **${status.charAt(0).toUpperCase()}${status.slice(1)}:** —`;
    return `- **${status.charAt(0).toUpperCase()}${status.slice(1)}:** ${formatDuration(segment.endMs - segment.startMs)}`;
  });

  const deliverableLines = params.deliverables.map((item) => {
    const line =
      item.billing_kind && item.billing_kind !== "supplement"
        ? buildDeliverablePricingLine(
            item.billing_kind as DeliverableBillingKind,
            params.propertyAddress ?? "Property",
            item.billing_line_count,
          )
        : item.billing_kind === "supplement"
          ? buildDeliverablePricingLine(
              "supplement",
              params.propertyAddress ?? "Property",
              item.billing_line_count,
            )
          : null;

    const price = line != null ? formatMoney(line.lineTotal) : null;
    const label = deliverableShortLabel(item);
    const priceSuffix = price ? ` · ${price}` : "";
    return `- ${item.title} · ${label}${priceSuffix}`;
  });

  const milestoneLines = [
    `- Ticket opened · ${formatNoteDate(params.ticketCreatedAt) ?? "—"}`,
    ...(lastDeliverableAt
      ? [
          `- Delivery package ready · ${params.deliverables.length} file${params.deliverables.length === 1 ? "" : "s"} · ${formatNoteDate(lastDeliverableAt) ?? "—"}`,
        ]
      : []),
    `- Invoice sent for payment · ${formatNoteDate(params.sentAt) ?? "—"}`,
  ];

  return [
    "**Invoice sent for payment**",
    "",
    `- **Invoice:** ${params.invoiceNumber}`,
    `- **Amount due:** ${params.amountFormatted}`,
    ...(dueDate ? [`- **Due date:** ${dueDate}`] : []),
    ...(params.propertyAddress?.trim()
      ? [`- **Property:** ${params.propertyAddress.trim()}`]
      : []),
    "",
    "**Turnaround**",
    `- **Total time to send:** ${formatDuration(turnaroundMs)}`,
    ...statusLines,
    "",
    "**Timeline**",
    ...milestoneLines,
    "",
    "**Sent by**",
    `- **From:** ${params.fromEmail}`,
    `- **By:** ${params.senderName}`,
    `- **To:** ${params.recipientEmail}`,
    `- **Text:** ${formatSmsNote({
      smsTo: params.smsTo,
      smsSent: params.smsSent,
      smsSkipped: params.smsSkipped,
    })}`,
    "",
    "**Delivery package** (after payment)",
    ...deliverableLines,
  ].join("\n");
};

export async function loadTicketInvoiceSentNoteContext(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    ticketId: number;
    invoiceNumber: string;
    amountFormatted: string;
    dueDate?: string | null;
    recipientEmail: string;
    propertyAddress?: string | null;
    senderName: string;
    fromEmail: string;
    sentAt: string;
    smsTo?: string | null;
    smsSent?: boolean;
    smsSkipped?: boolean;
  },
): Promise<TicketInvoiceSentNoteContext> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("created_at")
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const { data: deliverables } = await supabase
    .from("ticket_deliverables")
    .select("title, billing_kind, billing_line_count, created_at")
    .eq("ticket_id", params.ticketId)
    .eq("org_id", params.orgId)
    .order("sort_order", { ascending: true });

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("body, created_at, direction")
    .eq("ticket_id", params.ticketId)
    .order("created_at", { ascending: true });

  return {
    invoiceNumber: params.invoiceNumber,
    amountFormatted: params.amountFormatted,
    dueDate: params.dueDate,
    recipientEmail: params.recipientEmail,
    propertyAddress: params.propertyAddress,
    senderName: params.senderName,
    fromEmail: params.fromEmail,
    smsTo: params.smsTo,
    smsSent: params.smsSent,
    smsSkipped: params.smsSkipped,
    ticketCreatedAt: ticket?.created_at ?? params.sentAt,
    sentAt: params.sentAt,
    deliverables: deliverables ?? [],
    messages: messages ?? [],
  };
}
