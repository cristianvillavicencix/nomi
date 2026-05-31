import { useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import {
  buildAuditPdfFilename,
  generateWebsiteAuditPdfBase64,
} from "@/lbs/website-monitor/audit/websiteAuditPdfExport";

export const WebsiteAuditSendDialog = ({
  open,
  onOpenChange,
  audit,
  siteLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: WebsiteAudit;
  siteLabel?: string;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const label = siteLabel ?? audit.audit_url;
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(`Reporte web — ${label}`);
  const [message, setMessage] = useState(
    `Hola,\n\nAdjunto el informe completo del reporte web para ${label}.\n\nScore combinado: ${audit.overall_score ?? "—"}\nURL: ${audit.audit_url}\n\nSaludos.`,
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      notify("Ingresa un correo válido del cliente.", { type: "warning" });
      return;
    }

    setSending(true);
    try {
      notify("Generando PDF del reporte…", { type: "info" });
      const pdfBase64 = await generateWebsiteAuditPdfBase64();
      const filename = buildAuditPdfFilename(audit, siteLabel);

      await dataProvider.websiteAuditSend({
        auditId: audit.id,
        to: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        pdfBase64,
        filename,
      });

      onOpenChange(false);
      notify(`Reporte enviado a ${email.trim()} con PDF adjunto`, {
        type: "success",
      });
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "No se pudo enviar el reporte",
        { type: "error" },
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar reporte al cliente</DialogTitle>
          <DialogDescription>
            Se generará el mismo PDF del informe (scores, métricas, contenido y
            todos los hallazgos) y se enviará adjunto al correo del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="audit-send-email">Correo del cliente</Label>
            <Input
              id="audit-send-email"
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-send-subject">Asunto</Label>
            <Input
              id="audit-send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-send-message">Mensaje</Label>
            <Textarea
              id="audit-send-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar reporte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
