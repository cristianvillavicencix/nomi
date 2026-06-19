import type { Identifier } from "ra-core";
import type { TicketMessage } from "@/modules/types";
import type { TicketReplyAttachment } from "@/modules/tickets/uploadTicketAttachment";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export const ticketsProvider = {
  async replyTicket({
    ticketId,
    body,
    htmlBody,
    isInternalNote = false,
    attachments = [],
    toEmails,
    ccEmails,
  }: {
    ticketId: Identifier;
    body: string;
    htmlBody?: string;
    isInternalNote?: boolean;
    attachments?: TicketReplyAttachment[];
    toEmails?: string[];
    ccEmails?: string[];
  }) {
    const { data, error } = await invokeEdgeFunction<{
      message: TicketMessage;
      email_sent?: boolean;
      email_skipped?: boolean;
      is_internal_note?: boolean;
    }>("reply_ticket", {
      method: "POST",
      body: {
        ticket_id: Number(ticketId),
        body,
        html_body: htmlBody,
        is_internal_note: isInternalNote,
        attachments,
        to_emails: toEmails,
        ...(ccEmails?.length ? { cc_emails: ccEmails } : {}),
      },
    });

    if (error || !data?.message) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to send reply")
          : "Failed to send reply",
      );
    }

    return data;
  },

  async mergeTickets({
    primaryTicketId,
    mergeTicketIds,
  }: {
    primaryTicketId: Identifier;
    mergeTicketIds: Identifier[];
  }) {
    const { data, error } = await invokeEdgeFunction<{
      primary_ticket_id: number;
      merged_ticket_ids: number[];
    }>("merge_tickets", {
      method: "POST",
      body: {
        primary_ticket_id: Number(primaryTicketId),
        merge_ticket_ids: mergeTicketIds.map((id) => Number(id)),
      },
    });

    if (error || !data?.primary_ticket_id) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to merge tickets")
          : "Failed to merge tickets",
      );
    }

    return data;
  },

  async createTicketInvoice({
    ticketId,
    baseUrl,
    message,
  }: {
    ticketId: Identifier;
    baseUrl?: string;
    message?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      payment_url: string;
      to: string;
    }>("create_ticket_invoice", {
      method: "POST",
      body: {
        ticket_id: Number(ticketId),
        ...(baseUrl ? { base_url: baseUrl } : {}),
        ...(message ? { message } : {}),
      },
    });

    if (error || !data?.invoice) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to create ticket invoice",
            )
          : "Failed to create ticket invoice",
      );
    }

    return data;
  },

  async prepareTicketInvoice({
    ticketId,
    baseUrl,
  }: {
    ticketId: Identifier;
    baseUrl?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      line_items: Record<string, unknown>[];
      payment_url: string;
      to: string;
    }>("prepare_ticket_invoice", {
      method: "POST",
      body: {
        ticket_id: Number(ticketId),
        ...(baseUrl ? { base_url: baseUrl } : {}),
      },
    });

    if (error || !data?.invoice) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to prepare invoice",
            )
          : "Failed to prepare invoice",
      );
    }

    return data;
  },

  async sendTicketInvoice({
    ticketId,
    baseUrl,
    message,
    subject,
    smsTo,
    sendSms,
  }: {
    ticketId: Identifier;
    baseUrl?: string;
    message?: string;
    subject?: string;
    smsTo?: string;
    sendSms?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      payment_url: string;
      to: string;
    }>("send_ticket_invoice", {
      method: "POST",
      body: {
        ticket_id: Number(ticketId),
        ...(baseUrl ? { base_url: baseUrl } : {}),
        ...(message ? { message } : {}),
        ...(subject ? { subject } : {}),
        ...(smsTo ? { sms_to: smsTo } : {}),
        ...(sendSms ? { send_sms: true } : {}),
      },
    });

    if (error || !data?.invoice) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to send invoice")
          : "Failed to send invoice",
      );
    }

    return data;
  },

  async cancelTicketInvoiceDraft({ ticketId }: { ticketId: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      cancelled?: boolean;
      skipped?: boolean;
    }>("cancel_ticket_invoice", {
      method: "POST",
      body: { ticket_id: Number(ticketId) },
    });

    if (error) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Could not cancel invoice draft",
            )
          : "Could not cancel invoice draft",
      );
    }

    return data;
  },

  async deliverTicket({ ticketId }: { ticketId: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      delivered: boolean;
      duplicate?: boolean;
      ticket_id?: number;
    }>("deliver_ticket", {
      method: "POST",
      body: { ticket_id: Number(ticketId) },
    });

    if (error || !data?.delivered) {
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Could not deliver files")
          : "Could not deliver files",
      );
    }

    return data;
  },
};
