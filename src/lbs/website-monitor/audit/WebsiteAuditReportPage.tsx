import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { AuditFinding, WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditReportView } from "@/lbs/website-monitor/audit/WebsiteAuditReportView";
import { fetchPreviousDoneAudit } from "@/lbs/website-monitor/audit/websiteAuditQueries";

export const WebsiteAuditReportPage = () => {
  const { siteId, auditId } = useParams<{ siteId: string; auditId: string }>();
  const numericAuditId = Number(auditId);

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
  });

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
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
              findings={findings}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
