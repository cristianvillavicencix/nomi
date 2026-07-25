import { useCallback, useEffect, useRef } from "react";
import { useGetIdentity, useDataProvider } from "ra-core";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket, TicketMessage } from "@/modules/types";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";
import {
  hasRecentSelfTicketActivity,
  markSelfTicketActivity,
} from "@/modules/notifications/ticketSelfActivity";
import { TICKET_WORKSPACE_SETTINGS_QUERY_KEY } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { DEFAULT_TICKET_WORKSPACE_SETTINGS } from "@/modules/settings/tickets/ticketWorkspaceSettings";

const trimNotifiedIds = (notifiedIds: Set<string>) => {
  if (notifiedIds.size <= 500) return;
  const recentIds = Array.from(notifiedIds).slice(-100);
  notifiedIds.clear();
  recentIds.forEach((id) => notifiedIds.add(id));
};

const isViewingTicket = (pathname: string, ticketId: string | number) =>
  pathname.includes(`/tickets/${ticketId}/`);

const isMessageFromCurrentMember = (
  message: TicketMessage,
  memberId: string | number | null | undefined,
) =>
  message.author_member_id != null &&
  String(message.author_member_id) === String(memberId ?? "");

/** Only inbound client mail and internal notes from teammates should alert. */
const isIncomingTicketAlert = (
  message: TicketMessage,
  memberId: string | number | null | undefined,
) => {
  if (isMessageFromCurrentMember(message, memberId)) return false;
  if (message.direction === "outbound") return false;
  if (message.direction === "inbound") return true;
  if (message.direction === "internal") {
    return message.author_member_id != null;
  }
  return message.author_member_id == null;
};

export const useTicketsNotifications = () => {
  const { identity } = useGetIdentity();
  const location = useLocation();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { pushNotification } = useNotificationPrefsContext();
  const notifiedMessageIdsRef = useRef(new Set<string>());
  const notifiedAssignmentIdsRef = useRef(new Set<string>());

  const { data: workspaceData } = useQuery({
    queryKey: TICKET_WORKSPACE_SETTINGS_QUERY_KEY,
    queryFn: () => dataProvider.getTicketWorkspaceSettings(),
    staleTime: 60_000,
  });
  const workspace =
    workspaceData?.workspace ?? DEFAULT_TICKET_WORKSPACE_SETTINGS;

  const notifyTicketMessage = useCallback(
    async (message: TicketMessage) => {
      const messageId = String(message.id);
      if (notifiedMessageIdsRef.current.has(messageId)) return;
      notifiedMessageIdsRef.current.add(messageId);
      trimNotifiedIds(notifiedMessageIdsRef.current);

      if (!isIncomingTicketAlert(message, identity?.id)) return;

      const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id, subject, assignee_id")
        .eq("id", message.ticket_id)
        .maybeSingle();

      if (error || !ticket) return;
      if (
        workspace.notification_audience === "assignee" &&
        String(ticket.assignee_id) !== String(identity?.id ?? "")
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
        sound:
          workspace.workspace_notify_sound && (!viewingTicket || !tabVisible),
        desktop: workspace.workspace_notify_desktop && !tabVisible,
        preview: true,
      });
    },
    [
      identity?.id,
      location.pathname,
      pushNotification,
      workspace.notification_audience,
      workspace.workspace_notify_desktop,
      workspace.workspace_notify_sound,
    ],
  );

  const notifyAssignment = useCallback(
    (ticket: Pick<Ticket, "id" | "subject" | "assignee_id">) => {
      if (ticket.assignee_id == null) return;
      if (String(ticket.assignee_id) !== String(identity?.id ?? "")) return;

      if (hasRecentSelfTicketActivity(ticket.id)) return;

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
        preview: true,
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

          if (isMessageFromCurrentMember(message, identity.id)) {
            markSelfTicketActivity(message.ticket_id);
            return;
          }

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
          if (
            String(ticket.assignee_id) === String(previous?.assignee_id ?? "")
          ) {
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
