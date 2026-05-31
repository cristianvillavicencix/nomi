import type { CSSProperties } from "react";

/** Latino Business Support — branding for Web Report PDF/print. */
export const PRINT_AGENCY_NAME = "Latino Business Support";
export const PRINT_AGENCY_LOGO = "/logos/latino-business-support.jpg";
export const PRINT_REPORT_LABEL = "Web Report";

/** @deprecated Use PRINT_AGENCY_LOGO — kept for any legacy refs */
export const PRINT_LOGO_DARK = PRINT_AGENCY_LOGO;
export const PRINT_LOGO_LIGHT = PRINT_AGENCY_LOGO;

export const printTheme = {
  /** LBS logo blue */
  brand: "#2b78c5",
  brandMid: "#36b5b0",
  brandSoft: "#eef6fc",
  brandBorder: "#b8dce8",
  text: "#1e293b",
  textSoft: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  surface: "#f8fafc",
  white: "#ffffff",
  red: "#dc2626",
  redSoft: "#fef2f2",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  green: "#059669",
  greenSoft: "#ecfdf5",
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  pageWidth: 794,
  pagePadX: 48,
  pagePadY: 40,
} as const;

/** Logo aspect ratio from source asset (1024×510). */
export const PRINT_AGENCY_LOGO_RATIO = 1024 / 510;

export const printAgencyLogoStyle = (width: number): CSSProperties => ({
  width,
  height: Math.round(width / PRINT_AGENCY_LOGO_RATIO),
  objectFit: "contain",
  display: "block",
});

export const printPageStyle = (extra?: CSSProperties): CSSProperties => ({
  width: printTheme.pageWidth,
  maxWidth: printTheme.pageWidth,
  boxSizing: "border-box",
  padding: `${printTheme.pagePadY}px ${printTheme.pagePadX}px`,
  background: printTheme.white,
  color: printTheme.text,
  breakAfter: "page",
  pageBreakAfter: "always",
  ...extra,
});

export const scoreColor = (value?: number | null) => {
  if (value == null) return printTheme.muted;
  if (value >= 90) return printTheme.green;
  if (value >= 50) return printTheme.amber;
  return printTheme.red;
};

export const scoreLabelPlain = (value?: number | null) => {
  if (value == null) return "Sin dato";
  if (value >= 90) return "Excelente";
  if (value >= 50) return "Mejorable";
  return "Urgente";
};
