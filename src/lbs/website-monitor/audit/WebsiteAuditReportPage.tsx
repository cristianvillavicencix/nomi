import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { AuditFinding, WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditPrintDocument } from "@/lbs/website-monitor/audit/WebsiteAuditPrintDocument";
import { WebsiteAuditReportView } from "@/lbs/website-monitor/audit/WebsiteAuditReportView";
import { fetchPreviousDoneAudit } from "@/lbs/website-monitor/audit/websiteAuditQueries";
import { registerWebsiteAuditWatch } from "@/lbs/website-monitor/audit/websiteAuditWatchStorage";

export const WebsiteAuditReportPage = () => {
  const { siteId, auditId } = useParams<{ siteId: string; auditId: string }>();
  const numericAuditId = Number(auditId);
  const numericSiteId = Number(siteId);

  const { data: site } = useQuery({
    queryKey: ["monitored-website-label", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitored_websites")
        .select("display_name, url")
        .eq("id", numericSiteId)
        .maybeSingle();
      if (error) throw error;
      return data as { display_name?: string | null; url?: string } | null;
    },
    enabled: Number.isFinite(numericSiteId),
  });

  const siteLabel =
    site?.display_name?.trim() || site?.url?.trim() || undefined;

  const { data: audit, isPending } = useQuery({
    queryKey: ["website-audit-detail", auditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_audits")
        .select("*")
        .eq("id", numericAuditId)
        .maybeSingle();
      if (error) throw error;
      return (data as WebsiteAudit | null) ?? null;
    },
    enabled: Number.isFinite(numericAuditId),
    refetchInterval: (query) => {
      const audit = query.state.data;
      if (!audit) return false;
      if (audit.status === "queued" || audit.status === "running") return 3000;
      if (
        audit.ai_summary_status === "pending" ||
        audit.ai_summary_status === "running"
      ) {
        return 3000;
      }
      return false;
    },
  });

  useEffect(() => {
    if (!audit || !siteId) return;
    if (audit.status !== "queued" && audit.status !== "running") return;
    registerWebsiteAuditWatch({
      auditId: audit.id,
      siteId: Number(siteId),
      siteLabel: siteLabel ?? audit.audit_url,
      requestedAt: audit.requested_at,
    });
  }, [audit, siteId, siteLabel]);

  const { data: findings = [] } = useQuery({
    queryKey: ["website-audit-findings", numericAuditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", numericAuditId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuditFinding[];
    },
    enabled: audit?.status === "done",
  });

  const { data: previousAudit } = useQuery({
    queryKey: ["website-audit-previous", siteId, numericAuditId],
    queryFn: () => fetchPreviousDoneAudit(siteId!, numericAuditId),
    enabled: audit?.status === "done" && siteId != null,
  });

  const { data: previousFindings = [] } = useQuery({
    queryKey: ["website-audit-previous-findings", previousAudit?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", previousAudit!.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuditFinding[];
    },
    enabled: previousAudit?.status === "done" && previousAudit.id != null,
  });

  return (
    <>
      <div className="web-audit-report-screen mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/web-monitor/${siteId}/show`}>
            <ArrowLeft className="mr-2 size-4" />
            Volver al sitio
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Web Report</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando reporte…
              </p>
            ) : !audit ? (
              <p className="text-sm text-muted-foreground">
                No se encontró este reporte.
              </p>
            ) : (
              <WebsiteAuditReportView
                audit={audit}
                previousAudit={previousAudit ?? undefined}
                previousFindings={previousFindings}
                findings={findings}
                siteLabel={siteLabel}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {audit?.status === "done" ? (
        <div className="web-audit-report-print-only" aria-hidden>
          <WebsiteAuditPrintDocument
            audit={audit}
            findings={findings}
            siteLabel={siteLabel}
            previousAudit={previousAudit}
            previousFindings={previousFindings}
          />
        </div>
      ) : null}
    </>
  );
};
