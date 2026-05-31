import { Download, Mail, Printer } from "lucide-react";
import { useState } from "react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditSendDialog } from "@/lbs/website-monitor/audit/WebsiteAuditSendDialog";
import {
  downloadWebsiteAuditPdf,
  printWebsiteAuditReport,
} from "@/lbs/website-monitor/audit/websiteAuditPdfExport";

export const WebsiteAuditReportActions = ({
  audit,
  siteLabel,
}: {
  audit: WebsiteAudit;
  siteLabel?: string;
}) => {
  const notify = useNotify();
  const [sendOpen, setSendOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (audit.status !== "done") return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadWebsiteAuditPdf(audit, siteLabel);
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "No se pudo generar el PDF",
        { type: "error" },
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => printWebsiteAuditReport()}
        >
          <Printer className="mr-2 size-4" />
          Imprimir reporte
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={downloading}
          onClick={() => void handleDownload()}
        >
          <Download className="mr-2 size-4" />
          {downloading ? "Generando PDF…" : "Descargar PDF"}
        </Button>
        <Button type="button" size="sm" onClick={() => setSendOpen(true)}>
          <Mail className="mr-2 size-4" />
          Enviar
        </Button>
      </div>
      <WebsiteAuditSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        audit={audit}
        siteLabel={siteLabel}
      />
    </>
  );
};
