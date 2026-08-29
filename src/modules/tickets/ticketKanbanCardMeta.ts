import type { Ticket } from "@/modules/types";

export type TicketKanbanRibbon = {
  key: string;
  label: string;
  className: string;
};

/** Fixed board classification options (not billing). */
export const TICKET_SERVICE_TYPE_OPTIONS = [
  { id: "xactimate", label: "Xactimate" },
  { id: "roof", label: "Roof" },
  { id: "siding", label: "Siding" },
  { id: "asbestos", label: "Asbestos" },
  { id: "esx", label: "ESX" },
  { id: "pdf", label: "PDF" },
  { id: "weather", label: "Weather" },
  { id: "other", label: "Other" },
] as const;

export type TicketServiceTypeId =
  (typeof TICKET_SERVICE_TYPE_OPTIONS)[number]["id"];

const LABEL_BY_ID = Object.fromEntries(
  TICKET_SERVICE_TYPE_OPTIONS.map((option) => [option.id, option.label]),
) as Record<TicketServiceTypeId, string>;

export const ticketServiceTypeLabel = (id: string) =>
  LABEL_BY_ID[id as TicketServiceTypeId] ?? id;

export const normalizeTicketServiceTypes = (
  value?: string[] | null,
): TicketServiceTypeId[] => {
  if (!Array.isArray(value) || value.length === 0) return [];
  const allowed = new Set(
    TICKET_SERVICE_TYPE_OPTIONS.map((option) => option.id),
  );
  const next: TicketServiceTypeId[] = [];
  for (const raw of value) {
    const id = String(raw ?? "")
      .trim()
      .toLowerCase() as TicketServiceTypeId;
    if (!allowed.has(id) || next.includes(id)) continue;
    next.push(id);
  }
  return next;
};

/** Short corner ribbon for payment / delivery state. */
export const resolveTicketKanbanRibbon = (
  invoiceBadge: { key: string; label: string } | null | undefined,
): TicketKanbanRibbon | null => {
  if (!invoiceBadge) return null;

  switch (invoiceBadge.key) {
    case "overdue":
      return {
        key: "overdue",
        label: "Overdue",
        className: "bg-destructive text-destructive-foreground",
      };
    case "pending":
    case "awaiting-payment":
      return {
        key: "awaiting",
        label: "Awaiting",
        className: "bg-amber-500 text-white dark:bg-amber-600",
      };
    case "paid":
      return {
        key: "paid",
        label: "Paid",
        className: "bg-emerald-600 text-white dark:bg-emerald-500",
      };
    case "delivered":
      return {
        key: "delivered",
        label: "Delivered",
        className: "bg-emerald-700 text-white dark:bg-emerald-600",
      };
    case "delivery-pending":
      return {
        key: "delivery",
        label: "Delivery",
        className: "bg-violet-600 text-white dark:bg-violet-500",
      };
    case "scheduled":
      return {
        key: "scheduled",
        label: "Scheduled",
        className: "bg-sky-600 text-white dark:bg-sky-500",
      };
    default:
      return null;
  }
};

/** Labels for board chips — from ticket.service_types only. */
export const getTicketServiceTypeLabels = (ticket: Ticket): string[] =>
  normalizeTicketServiceTypes(ticket.service_types).map(ticketServiceTypeLabel);

export const toggleTicketServiceType = (
  current: string[] | null | undefined,
  id: TicketServiceTypeId,
): TicketServiceTypeId[] => {
  const existing = normalizeTicketServiceTypes(current);
  return existing.includes(id)
    ? existing.filter((entry) => entry !== id)
    : [...existing, id];
};
