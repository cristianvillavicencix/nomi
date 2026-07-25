export type InvoiceSentNoteDeliverable = {
  title: string;
  detail: string;
};

export type InvoiceSentInternalNote = {
  invoiceNumber: string | null;
  amountDue: string | null;
  dueDate: string | null;
  property: string | null;
  turnaroundTotal: string | null;
  statusNew: string | null;
  statusOpen: string | null;
  statusWaiting: string | null;
  timelineOpened: string | null;
  timelinePackageReady: string | null;
  timelineSent: string | null;
  from: string | null;
  by: string | null;
  to: string | null;
  text: string | null;
  deliverables: InvoiceSentNoteDeliverable[];
};

const FIELD =
  /^-?\s*\*\*(Invoice|Amount due|Due date|Property|Total time to send|New|Open|Waiting|From|By|To|Text):\*\*\s*(.+)$/i;

const isInvoiceSentHeading = (line: string) =>
  /^\*{0,2}Invoice sent for payment\*{0,2}$/i.test(line.trim());

export const isInvoiceSentInternalNote = (body?: string | null) => {
  const text = body?.trim();
  if (!text) return false;
  const first = text.split("\n").find((line) => line.trim()) ?? "";
  return isInvoiceSentHeading(first) || text.includes("**Invoice sent for payment**");
};

export const previewInvoiceSentInternalNote = (body?: string | null) => {
  const parsed = parseInvoiceSentInternalNote(body);
  if (!parsed) return null;
  const parts = [
    "Invoice sent",
    parsed.invoiceNumber,
    parsed.amountDue,
    parsed.turnaroundTotal ? `${parsed.turnaroundTotal} turnaround` : null,
  ].filter(Boolean);
  return parts.join(" · ");
};

const parseBulletLine = (line: string) => {
  const trimmed = line.trim().replace(/^-+\s*/, "");
  return trimmed || null;
};

export const parseInvoiceSentInternalNote = (
  body?: string | null,
): InvoiceSentInternalNote | null => {
  if (!isInvoiceSentInternalNote(body)) return null;

  const lines = (body ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result: InvoiceSentInternalNote = {
    invoiceNumber: null,
    amountDue: null,
    dueDate: null,
    property: null,
    turnaroundTotal: null,
    statusNew: null,
    statusOpen: null,
    statusWaiting: null,
    timelineOpened: null,
    timelinePackageReady: null,
    timelineSent: null,
    from: null,
    by: null,
    to: null,
    text: null,
    deliverables: [],
  };

  let section:
    | "meta"
    | "turnaround"
    | "timeline"
    | "sent"
    | "delivery"
    | null = "meta";

  for (const line of lines) {
    if (isInvoiceSentHeading(line)) continue;

    if (/^\*{0,2}Turnaround\*{0,2}$/i.test(line)) {
      section = "turnaround";
      continue;
    }
    if (/^\*{0,2}Timeline\*{0,2}$/i.test(line)) {
      section = "timeline";
      continue;
    }
    if (/^\*{0,2}Sent by\*{0,2}$/i.test(line)) {
      section = "sent";
      continue;
    }
    if (/^\*{0,2}Delivery package\*{0,2}/i.test(line)) {
      section = "delivery";
      continue;
    }

    const field = line.match(FIELD);
    if (field) {
      const key = field[1].toLowerCase();
      const value = field[2].trim();
      if (key === "invoice") result.invoiceNumber = value;
      else if (key === "amount due") result.amountDue = value;
      else if (key === "due date") result.dueDate = value;
      else if (key === "property") result.property = value;
      else if (key === "total time to send") result.turnaroundTotal = value;
      else if (key === "new") result.statusNew = value;
      else if (key === "open") result.statusOpen = value;
      else if (key === "waiting") result.statusWaiting = value;
      else if (key === "from") result.from = value;
      else if (key === "by") result.by = value;
      else if (key === "to") result.to = value;
      else if (key === "text") result.text = value;
      continue;
    }

    // Compact one-liners from newer note format
    const compactInvoice = line.match(
      /^([A-Z]{2,}-\d{4}-\d+)\s*·\s*(\$[\d,.]+)\s*(?:·\s*Due\s+(.+))?$/i,
    );
    if (compactInvoice) {
      result.invoiceNumber = compactInvoice[1];
      result.amountDue = compactInvoice[2];
      if (compactInvoice[3]) result.dueDate = compactInvoice[3].trim();
      continue;
    }

    const compactTurnaround = line.match(
      /^Turnaround:\s*([^·]+)(?:·\s*New\s+([^·]+))?(?:·\s*Open\s+([^·]+))?(?:·\s*Waiting\s+(.+))?$/i,
    );
    if (compactTurnaround) {
      result.turnaroundTotal = compactTurnaround[1].trim();
      if (compactTurnaround[2]) result.statusNew = compactTurnaround[2].trim();
      if (compactTurnaround[3]) result.statusOpen = compactTurnaround[3].trim();
      if (compactTurnaround[4])
        result.statusWaiting = compactTurnaround[4].trim();
      continue;
    }

    if (/^Property:\s*/i.test(line)) {
      result.property = line.replace(/^Property:\s*/i, "").trim();
      continue;
    }

    const bullet = parseBulletLine(line);
    if (!bullet) continue;

    if (section === "timeline" || /^Ticket opened/i.test(bullet)) {
      if (/^Ticket opened/i.test(bullet)) {
        result.timelineOpened = bullet.replace(/^Ticket opened\s*·?\s*/i, "");
        continue;
      }
      if (/^Delivery package ready/i.test(bullet)) {
        result.timelinePackageReady = bullet
          .replace(/^Delivery package ready\s*·?\s*/i, "")
          .trim();
        continue;
      }
      if (/^Invoice sent/i.test(bullet)) {
        result.timelineSent = bullet
          .replace(/^Invoice sent(?: for payment)?\s*·?\s*/i, "")
          .trim();
        continue;
      }
    }

    if (section === "delivery" || section === null) {
      const [title, ...rest] = bullet.split(" · ");
      if (title) {
        result.deliverables.push({
          title: title.trim(),
          detail: rest.join(" · ").trim(),
        });
      }
    }
  }

  if (!result.invoiceNumber && !result.amountDue) return null;
  return result;
};
