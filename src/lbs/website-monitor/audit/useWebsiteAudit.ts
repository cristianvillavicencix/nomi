import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  AuditFinding,
  WebsiteAudit,
} from "@/lbs/website-monitor/audit/types";
import {
  fetchAuditHistory,
  fetchPreviousDoneAudit,
} from "@/lbs/website-monitor/audit/websiteAuditQueries";

const auditKey = (siteId: Identifier) => ["website-audit", siteId] as const;
const historyKey = (siteId: Identifier) =>
  ["website-audit-history", siteId] as const;
const findingsKey = (auditId: number) =>
  ["website-audit-findings", auditId] as const;
const previousKey = (siteId: Identifier, auditId: number) =>
  ["website-audit-previous", siteId, auditId] as const;

const fetchLatestAudit = async (siteId: Identifier) => {
  const history = await fetchAuditHistory(siteId);
  return history[0] ?? null;
};

const fetchFindings = async (auditId: number) => {
  const { data, error } = await supabase
    .from("audit_findings")
    .select("*")
    .eq("audit_id", auditId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AuditFinding[];
};

export const useWebsiteAudit = (siteId: Identifier) => {
  const queryClient = useQueryClient();

  const {
    data: audit,
    isPending,
    refetch,
  } = useQuery({
    queryKey: auditKey(siteId),
    queryFn: () => fetchLatestAudit(siteId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 3000 : false;
    },
  });

  const { data: history = [], isPending: historyPending } = useQuery({
    queryKey: historyKey(siteId),
    queryFn: () => fetchAuditHistory(siteId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`website_audits_${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "website_audits",
          filter: `monitored_website_id=eq.${Number(siteId)}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: auditKey(siteId) });
          void queryClient.invalidateQueries({ queryKey: historyKey(siteId) });
          if (audit?.id) {
            void queryClient.invalidateQueries({
              queryKey: findingsKey(audit.id),
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [audit?.id, queryClient, siteId]);

  const { data: findings = [], isPending: findingsPending } = useQuery({
    queryKey: findingsKey(audit?.id ?? 0),
    queryFn: () => fetchFindings(audit!.id),
    enabled: audit?.status === "done" && audit.id != null,
  });

  const { data: previousAudit } = useQuery({
    queryKey: previousKey(siteId, audit?.id ?? 0),
    queryFn: () => fetchPreviousDoneAudit(siteId, audit!.id),
    enabled: audit?.status === "done" && audit.id != null,
  });

  const isActive = audit?.status === "queued" || audit?.status === "running";

  return {
    audit,
    history,
    findings,
    previousAudit,
    isPending,
    historyPending,
    findingsPending,
    isActive,
    refetch,
  };
};

export type { WebsiteAudit };
