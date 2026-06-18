import type { Identifier } from "ra-core";
import type { TicketMessage } from "@/modules/types";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export const ticketsProvider = {
  async replyTicket({
    ticketId,
    body,
  }: {
    ticketId: Identifier;
    body: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      message: TicketMessage;
      email_sent?: boolean;
      email_skipped?: boolean;
    }>("reply_ticket", {
      method: "POST",
      body: {
        ticket_id: Number(ticketId),
        body,
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
};
