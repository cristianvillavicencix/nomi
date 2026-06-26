import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  buildTicketReadMap,
  type TicketMemberRead,
} from "@/modules/tickets/ticketReadState";

const readsQueryKey = (memberId?: string | number | null) =>
  ["ticket_member_reads", memberId] as const;

const isMissingReadsTableError = (error: {
  code?: string;
  message?: string;
}) => {
  const code = error.code ?? "";
  const message = error.message?.toLowerCase() ?? "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("ticket_member_reads") ||
    message.includes("does not exist")
  );
};

export const useTicketInboxReads = (ticketIds: string[]) => {
  const { identity } = useGetIdentity();
  const memberId = identity?.id;

  const { data: readMap = new Map<string, string>() } = useQuery({
    queryKey: [...readsQueryKey(memberId), ticketIds.join(",")],
    enabled: Boolean(memberId) && ticketIds.length > 0,
    queryFn: async () => {
      const numericIds = ticketIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      if (!numericIds.length) return new Map<string, string>();

      const { data, error } = await supabase
        .from("ticket_member_reads")
        .select("ticket_id, last_read_at")
        .eq("member_id", Number(memberId))
        .in("ticket_id", numericIds);

      if (error) {
        if (isMissingReadsTableError(error)) return new Map<string, string>();
        throw error;
      }
      return buildTicketReadMap((data ?? []) as TicketMemberRead[]);
    },
    staleTime: 10_000,
  });

  return readMap;
};

export const useTicketMemberRead = (ticketId: string | null) => {
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...readsQueryKey(memberId), "single", ticketId],
    enabled: Boolean(memberId && ticketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_member_reads")
        .select("last_read_at")
        .eq("member_id", Number(memberId))
        .eq("ticket_id", Number(ticketId))
        .maybeSingle();

      if (error) {
        if (isMissingReadsTableError(error)) return null;
        throw error;
      }
      return data?.last_read_at ?? null;
    },
    staleTime: 5_000,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!memberId || !ticketId) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from("ticket_member_reads").upsert(
        {
          ticket_id: Number(ticketId),
          member_id: Number(memberId),
          last_read_at: now,
        },
        { onConflict: "ticket_id,member_id" },
      );
      if (error) {
        if (isMissingReadsTableError(error)) return now;
        throw error;
      }
      return now;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readsQueryKey(memberId) });
    },
  });

  return {
    lastReadAt: query.data,
    isLoading: query.isLoading,
    markRead: markReadMutation.mutateAsync,
  };
};
