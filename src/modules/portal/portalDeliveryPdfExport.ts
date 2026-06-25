import { jsPDF } from "jspdf";
import { getPortalHandoffExpectations } from "@/modules/portal/portalHandoffExpectations";
import type { PortalLocale } from "@/modules/portal/portalI18n";
import { formatPortalDate, type PortalCredential, type PortalDelivery } from "@/modules/portal/portalTypes";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

const pdfCopy = {
  es: {
    title: "Resumen de entrega",
    project: "Proyecto",
    delivered: "Entregado",
    liveSite: "Sitio en vivo",
    staging: "Staging",
    plan: "Plan",
    credentials: "Accesos compartidos",
    service: "Servicio",
    username: "Usuario",
    url: "URL",
    password: "Contraseña",
    passwordProtected: "Protegida — consulta en el portal",
    noCredentials: "No hay accesos compartidos en este momento.",
    securityNote:
      "Las contraseñas no se incluyen en este PDF por seguridad. Ábrelas en el portal con tu email.",
  },
  en: {
    title: "Delivery summary",
    project: "Project",
    delivered: "Delivered",
    liveSite: "Live site",
    staging: "Staging",
    plan: "Plan",
    credentials: "Shared logins",
    service: "Service",
    username: "Username",
    url: "URL",
    password: "Password",
    passwordProtected: "Protected — view in portal",
    noCredentials: "No shared logins at this time.",
    securityNote:
      "Passwords are not included in this PDF for security. View them in the portal with your email.",
  },
} as const;

export type PortalDeliveryPdfInput = {
  projectName: string;
  delivery: PortalDelivery;
  siteUrl?: string | null;
  stagingUrl?: string | null;
  credentials: PortalCredential[];
  locale: PortalLocale;
};

export const downloadPortalDeliveryPdf = ({
  projectName,
  delivery,
  siteUrl,
  stagingUrl,
  credentials,
  locale,
}: PortalDeliveryPdfInput) => {
  const labels = pdfCopy[locale];
  const handoff = getPortalHandoffExpectations(locale);
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const contentWidth = 516;
  let y = margin;
  const lineHeight = 15;
  const pageHeight = doc.internal.pageSize.getHeight();

  const ensureSpace = (needed = lineHeight) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeln = (
    text: string,
    options?: { bold?: boolean; size?: number; gapAfter?: number },
  ) => {
    const size = options?.size ?? 11;
    doc.setFontSize(size);
    doc.setFont("helvetica", options?.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace();
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += options?.gapAfter ?? 0;
  };

  const writeBullets = (title: string, items: string[]) => {
    writeln(title, { bold: true, size: 12, gapAfter: 4 });
    for (const item of items) {
      ensureSpace();
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 12);
      for (const line of lines) {
        ensureSpace();
        doc.text(line, margin + 8, y);
        y += lineHeight;
      }
    }
    y += 6;
  };

  writeln(labels.title, { bold: true, size: 18, gapAfter: 8 });
  writeln(`${labels.project}: ${projectName}`);
  writeln(
    `${labels.delivered}: ${formatPortalDate(
      delivery.delivery_date ?? delivery.delivered_at,
      localeTag,
    )}`,
  );
  if (delivery.plan_name) {
    writeln(`${labels.plan}: ${delivery.plan_name}`);
  }
  if (siteUrl?.trim()) {
    writeln(`${labels.liveSite}: ${siteUrl.trim()}`);
  }
  if (stagingUrl?.trim()) {
    writeln(`${labels.staging}: ${stagingUrl.trim()}`);
  }

  y += 8;
  writeln(labels.credentials, { bold: true, size: 13, gapAfter: 6 });

  const sorted = [...credentials].sort(
    (left, right) =>
      (left.portal_sort_order ?? 0) - (right.portal_sort_order ?? 0),
  );

  if (sorted.length === 0) {
    writeln(labels.noCredentials, { gapAfter: 8 });
  } else {
    for (const entry of sorted) {
      writeln(entry.label, { bold: true });
      if (entry.username) {
        writeln(`${labels.username}: ${entry.username}`);
      }
      if (entry.url) {
        writeln(`${labels.url}: ${entry.url}`);
      }
      writeln(
        `${labels.password}: ${
          entry.has_password ? labels.passwordProtected : "—"
        }`,
      );
      y += 4;
    }
  }

  writeln(labels.securityNote, { size: 10, gapAfter: 10 });
  writeBullets(handoff.lbsTitle, handoff.lbsItems);
  writeBullets(handoff.clientTitle, handoff.clientItems);
  writeln(handoff.footnote, { size: 10 });

  doc.save(`${slugify(projectName)}-delivery-summary.pdf`);
};
