import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { PRINT_AGENCY_LOGO } from "@/lbs/website-monitor/audit/websiteAuditPrintTheme";

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

/** Minimal document — no Tailwind / oklch (html2canvas cannot parse oklch). */
const CAPTURE_IFRAME_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    img { display: block; max-width: 100%; }
  </style>
</head>
<body></body>
</html>`;

const waitForImages = (root: HTMLElement) =>
  Promise.all(
    Array.from(root.querySelectorAll("img")).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );

const waitForLayout = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const toAbsoluteUrl = (src: string) =>
  src.startsWith("http")
    ? src
    : `${window.location.origin}${src.startsWith("/") ? src : `/${src}`}`;

const fetchImageAsDataUrl = async (src: string): Promise<string | null> => {
  try {
    const response = await fetch(toAbsoluteUrl(src));
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Invalid image data"));
      };
      reader.onerror = () =>
        reject(reader.error ?? new Error("Image read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/** html2canvas often skips <img> in iframes unless src is an inline data URL. */
const embedImagesAsDataUrls = async (root: HTMLElement) => {
  const images = Array.from(root.querySelectorAll("img"));
  const uniqueSrcs = new Map<string, string | null>();

  for (const img of images) {
    const src = img.getAttribute("src")?.trim();
    if (!src || src.startsWith("data:")) continue;

    if (!uniqueSrcs.has(src)) {
      uniqueSrcs.set(src, await fetchImageAsDataUrl(src));
    }

    const dataUrl = uniqueSrcs.get(src);
    if (!dataUrl) continue;

    img.setAttribute("src", dataUrl);
    img.removeAttribute("crossorigin");
    await img.decode().catch(() => undefined);
  }
};

const sanitizeCloneForCapture = (root: HTMLElement) => {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src?.startsWith("/")) {
      img.setAttribute("src", toAbsoluteUrl(src));
    }
    img.setAttribute("crossorigin", "anonymous");
  });
};

const stripUnsupportedStyles = (doc: Document) => {
  doc
    .querySelectorAll("link[rel='stylesheet'], style")
    .forEach((node) => node.remove());
  doc.documentElement.style.cssText =
    "background:#fff;color:#0f172a;font-family:system-ui,sans-serif";
  doc.body.style.cssText = "margin:0;padding:0;background:#fff;color:#0f172a";
};

const canvasToImageData = (canvas: HTMLCanvasElement) => {
  try {
    return {
      data: canvas.toDataURL("image/jpeg", 0.92),
      format: "JPEG" as const,
    };
  } catch {
    return { data: canvas.toDataURL("image/png"), format: "PNG" as const };
  }
};

const addCanvasToPdf = (
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  startNewPage: boolean,
): boolean => {
  const { data, format } = canvasToImageData(canvas);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  let hasPage = startNewPage;

  while (heightLeft > 0) {
    if (hasPage) pdf.addPage();
    hasPage = true;
    pdf.addImage(data, format, 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    position -= pageHeight;
  }

  return hasPage;
};

const captureSection = (section: HTMLElement, captureWindow: Window) =>
  html2canvas(section, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    width: section.scrollWidth,
    height: section.scrollHeight,
    windowWidth: section.scrollWidth,
    windowHeight: section.scrollHeight,
    window: captureWindow,
    onclone: (clonedDoc) => {
      stripUnsupportedStyles(clonedDoc);
      clonedDoc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (src?.startsWith("data:")) {
          img.removeAttribute("crossorigin");
        }
      });
    },
  });

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
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(blob);
  });

const createCaptureHost = (source: HTMLElement) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.title = "PDF capture";
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:0;border:0;opacity:0;pointer-events:none;visibility:hidden";

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("No se pudo preparar la captura del PDF.");
  }

  doc.open();
  doc.write(CAPTURE_IFRAME_HTML);
  doc.close();

  const clone = source.cloneNode(true) as HTMLElement;
  sanitizeCloneForCapture(clone);

  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  cloneImages.forEach((cloneImg, index) => {
    const srcImg = sourceImages[index];
    if (
      !(srcImg instanceof HTMLImageElement) ||
      !(cloneImg instanceof HTMLImageElement) ||
      !srcImg.complete ||
      srcImg.naturalWidth === 0
    ) {
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = srcImg.naturalWidth;
      canvas.height = srcImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(srcImg, 0, 0);
      cloneImg.src = canvas.toDataURL("image/jpeg", 0.95);
      cloneImg.removeAttribute("crossorigin");
    } catch {
      // fetch fallback in embedImagesAsDataUrls
    }
  });

  doc.body.appendChild(clone);

  return {
    iframe,
    root: clone,
    window: iframe.contentWindow!,
    dispose: () => {
      iframe.remove();
    },
  };
};

export const generateWebsiteAuditPdfBlob = async (): Promise<Blob> => {
  const el = document.getElementById(WEB_AUDIT_PDF_ROOT_ID);
  if (!el) {
    throw new Error(
      "El documento del reporte no está listo. Espera a que cargue.",
    );
  }

  const host = createCaptureHost(el);

  try {
    await fetchImageAsDataUrl(PRINT_AGENCY_LOGO);
    await embedImagesAsDataUrls(host.root);
    await waitForImages(host.root);
    await waitForLayout();

    const sections = Array.from(
      host.root.querySelectorAll<HTMLElement>(".web-audit-pdf-page"),
    );
    const targets = sections.length > 0 ? sections : [host.root];

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    let pdfHasContent = false;

    for (const section of targets) {
      const canvas = await captureSection(section, host.window);

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("No se pudo capturar una página del reporte.");
      }

      pdfHasContent = addCanvasToPdf(pdf, canvas, pdfHasContent);
    }

    if (!pdfHasContent) {
      throw new Error(
        "El PDF quedó vacío. Recarga la página e inténtalo de nuevo.",
      );
    }

    return pdf.output("blob");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/oklch|color function|unsupported color/i.test(message)) {
      throw new Error(
        "El navegador no pudo renderizar los estilos del reporte. Usa Imprimir → Guardar como PDF.",
      );
    }
    if (/canvas|memory|size/i.test(message)) {
      throw new Error(
        "El reporte es demasiado grande para generar el PDF en este navegador. Usa Imprimir → Guardar como PDF.",
      );
    }
    throw cause instanceof Error
      ? cause
      : new Error(
          "No se pudo generar el PDF. Usa Imprimir → Guardar como PDF.",
        );
  } finally {
    host.dispose();
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
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};
