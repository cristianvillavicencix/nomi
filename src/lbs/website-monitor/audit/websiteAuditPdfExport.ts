import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";

export const WEB_AUDIT_PDF_ROOT_ID = "web-audit-pdf-root";

export const buildAuditPdfFilename = (
  audit: WebsiteAudit,
  siteLabel?: string,
) => {
  const raw = (siteLabel ?? audit.audit_url ?? "sitio")
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `reporte-web-${raw || "audit"}-${audit.id}.pdf`;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el PDF"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("PDF inválido"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(blob);
  });

export const generateWebsiteAuditPdfBlob = async (): Promise<Blob> => {
  const el = document.getElementById(WEB_AUDIT_PDF_ROOT_ID);
  if (!el) {
    throw new Error("El documento del reporte no está listo. Espera a que cargue.");
  }

  const wrapper = el.closest(".web-audit-report-print-only") as HTMLElement | null;
  const prevWrapperStyle = wrapper?.getAttribute("style") ?? null;
  const prevElStyle = el.getAttribute("style") ?? null;

  if (wrapper) {
    wrapper.style.cssText =
      "position:fixed;left:0;top:0;z-index:9999;opacity:1;pointer-events:none;width:794px;background:#fff";
  }
  el.style.cssText = "background:#fff;color:#111";

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    if (wrapper) {
      if (prevWrapperStyle == null) wrapper.removeAttribute("style");
      else wrapper.setAttribute("style", prevWrapperStyle);
    }
    if (prevElStyle == null) el.removeAttribute("style");
    else el.setAttribute("style", prevElStyle);
  }
};

export const generateWebsiteAuditPdfBase64 = async () => {
  const blob = await generateWebsiteAuditPdfBlob();
  return blobToBase64(blob);
};

export const printWebsiteAuditReport = () => {
  window.print();
};

export const downloadWebsiteAuditPdf = async (
  audit: WebsiteAudit,
  siteLabel?: string,
) => {
  const blob = await generateWebsiteAuditPdfBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildAuditPdfFilename(audit, siteLabel);
  anchor.click();
  URL.revokeObjectURL(url);
};
