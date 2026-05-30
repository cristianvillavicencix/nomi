import { Download, Loader2, Printer } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";

/** Phase 3: server-generated branded PDF. Until then: print-to-PDF from portal. */
export const WebsiteAuditPdfActions = ({ audit }: { audit: WebsiteAudit }) => {
  const notify = useNotify();

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (audit.pdf_storage_path) {
      notify("Descarga de PDF almacenado — Phase 3", { type: "info" });
      return;
    }
    notify(
      "PDF unificado con branding llegará en Phase 3. Usa Imprimir → Guardar como PDF por ahora.",
      { type: "info" },
    );
    window.print();
  };

  if (audit.status !== "done") return null;

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" size="sm" variant="default" onClick={handleDownload}>
        <Download className="mr-2 size-4" />
        Descargar PDF
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={handlePrint}>
        <Printer className="mr-2 size-4" />
        Imprimir
      </Button>
    </div>
  );
};

export const WebsiteAuditRunningHint = () => (
  <p className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" />
    Analizando móvil y desktop (puede tardar hasta 6 minutos)…
  </p>
);
