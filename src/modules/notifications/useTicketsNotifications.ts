import { useCallback, useEffect, useRef } from "react";
import { useGetIdentity } from "ra-core";
import { useLocation } from "react-router";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { Ticket, TicketMessage } from "@/modules/types";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";

const trimNotifiedIds = (notifiedIds: Set<string>) => {
  if (notifiedIds.size <= 500) return;
  const recentIds = Array.from(notifiedIds).slice(-100);
  notifiedIds.clear();
  recentIds.forEach((id) => notifiedIds.add(id));
};

const isViewingTicket = (pathname: string, ticketId: string | number) =>
  pathname.includes(`/tickets/${ticketId}/`);

export const useTicketsNotifications = () => {
  const { identity } = useGetIdentity();
  const location = useLocation();
  const { pushNotification } = useNotificationPrefsContext();
  const notifiedMessageIdsRef = useRef(new Set<string>());
  const notifiedAssignmentIdsRef = useRef(new Set<string>());

  const notifyTicketMessage = useCallback(
    async (message: TicketMessage) => {
      const messageId = String(message.id);
      if (notifiedMessageIdsRef.current.has(messageId)) return;
      notifiedMessageIdsRef.current.add(messageId);
      trimNotifiedIds(notifiedMessageIdsRef.current);

      const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id, subject, assignee_id")
        .eq("id", message.ticket_id)
        .maybeSingle();

      if (error || !ticket) return;
      if (String(ticket.assignee_id) !== String(identity?.id ?? "")) return;

      if (
        message.author_member_id != null &&
        String(message.author_member_id) === String(identity?.id ?? "")
      ) {
        return;
      }

      const tabVisible =
        document.visibilityState === "visible" && document.hasFocus();
      const viewingTicket = isViewingTicket(location.pathname, ticket.id);

      if (viewingTicket && tabVisible) return;

      const preview =
        message.body?.trim().slice(0, 120) || "New message on this ticket";

      pushNotification({
        category: "tickets_message",
        title: ticket.subject || "Ticket update",
        body: preview,
        tag: `ticket-msg-${message.id}`,
        href: `/tickets/${ticket.id}/show`,
        sound: !viewingTicket || !tabVisible,
        desktop: !tabVisible,
      });
    },
    [identity?.id, location.pathname, pushNotification],
  );

  const notifyAssignment = useCallback(
    (ticket: Pick<Ticket, "id" | "subject" | "assignee_id">) => {
      if (ticket.assignee_id == null) return;
      if (String(ticket.assignee_id) !== String(identity?.id ?? "")) return;

      const key = `assign-${ticket.id}-${ticket.assignee_id}`;
      if (notifiedAssignmentIdsRef.current.has(key)) return;
      notifiedAssignmentIdsRef.current.add(key);
      trimNotifiedIds(notifiedAssignmentIdsRef.current);

      pushNotification({
        category: "tickets_assigned",
        title: "Ticket assigned to you",
        body: ticket.subject || `Ticket #${ticket.id}`,
        tag: key,
        href: `/tickets/${ticket.id}/show`,
        desktop: true,
      });
    },
    [identity?.id, pushNotification],
  );

  useEffect(() => {
    if (!identity?.id) return;

    const channel = supabase
      .channel("tickets_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
        },
        (payload) => {
          const message = payload.new as TicketMessage | undefined;
          if (!message?.ticket_id || message.id == null) return;
          void notifyTicketMessage(message);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          const ticket = payload.new as Ticket | undefined;
          const previous = payload.old as Ticket | undefined;
          if (!ticket?.id) return;
          if (ticket.assignee_id == null) return;
          if (String(ticket.assignee_id) === String(previous?.assignee_id ?? "")) {
            return;
          }
          notifyAssignment(ticket);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, notifyAssignment, notifyTicketMessage]);
};
