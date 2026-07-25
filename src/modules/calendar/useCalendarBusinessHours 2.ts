import { useMemo } from "react";
import { useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useTicketWorkspaceSettings } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import {
  buildCalendarBusinessHoursSchedule,
  type CalendarBusinessHoursSchedule,
} from "@/modules/calendar/calendarBusinessHours";
import type { CalendarDisplayOptions } from "@/modules/calendar/calendarUtils";

export const useCalendarBusinessHours = (
  fallbackDisplay: CalendarDisplayOptions,
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: messagingSettings, isPending: messagingPending } = useQuery({
    queryKey: ["messaging-settings", "business-hours"],
    queryFn: () => dataProvider.getMessagingSettings(),
    staleTime: 60_000,
  });
  const { data: ticketSettings, isPending: ticketPending } =
    useTicketWorkspaceSettings();

  const schedule = useMemo(
    () =>
      buildCalendarBusinessHoursSchedule({
        communications: messagingSettings?.business_hours,
        workspace: ticketSettings?.workspace,
        fallbackDisplay,
      }),
    [
      fallbackDisplay,
      messagingSettings?.business_hours,
      ticketSettings?.workspace,
    ],
  );

  return {
    schedule,
    isPending: messagingPending || ticketPending,
  };
};

export type { CalendarBusinessHoursSchedule };
