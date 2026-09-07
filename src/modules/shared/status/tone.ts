/** Semantic tones. `toneClass` is the only place that names Tailwind color classes. */
export type Tone =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted"
  | "brand";

export type ToneSurface = "solid" | "soft" | "text" | "dot" | "border";

const TONE_CLASS: Record<Tone, Record<ToneSurface, string>> = {
  success: {
    solid: "bg-success text-success-foreground",
    soft: "border-transparent bg-success/15 text-success",
    text: "text-success",
    dot: "bg-success",
    border: "border-success/40 bg-success/10 text-success",
  },
  warning: {
    solid: "bg-warning text-warning-foreground",
    soft: "border-transparent bg-warning/20 text-warning-foreground",
    text: "text-warning-foreground",
    dot: "bg-warning",
    border: "border-warning/40 bg-warning/10 text-warning-foreground",
  },
  destructive: {
    solid: "bg-destructive text-white",
    soft: "border-transparent bg-destructive text-white",
    text: "text-destructive",
    dot: "bg-destructive",
    border: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  info: {
    solid: "bg-info text-info-foreground",
    soft: "border-transparent bg-info/15 text-info",
    text: "text-info",
    dot: "bg-info",
    border: "border-info/40 bg-info/10 text-info",
  },
  muted: {
    solid: "bg-muted-foreground text-background",
    soft: "text-muted-foreground",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
    border: "border-border bg-muted/40 text-muted-foreground",
  },
  brand: {
    solid: "bg-brand text-brand-foreground",
    soft: "border-transparent bg-brand/15 text-brand",
    text: "text-brand",
    dot: "bg-brand",
    border: "border-brand/40 bg-brand/10 text-brand",
  },
};

export const toneClass = (
  tone: Tone,
  surface: ToneSurface = "soft",
): string => TONE_CLASS[tone][surface];

export const toneCssValue = (tone: Tone): string => {
  switch (tone) {
    case "muted":
      return "var(--muted-foreground)";
    default:
      return `var(--${tone})`;
  }
};

export const toneBadgeVariant = (
  tone: Tone,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" => {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "destructive":
      return "destructive";
    case "info":
      return "info";
    case "brand":
      return "default";
    default:
      return "outline";
  }
};

/**
 * sRGB stand-ins of CSS tokens for PDF/email (no Tailwind in those surfaces).
 * Keep in lockstep with `--success` / `--brand` / `--destructive` in src/index.css.
 */
export const TONE_HEX = {
  success: "#2f9d6a",
  warning: "#d9a21b",
  destructive: "#dc3d3d",
  info: "#3b7fc4",
  muted: "#64748b",
  brand: "#2563c4",
  brandNavy: "#1e3a6e",
  foreground: "#111111",
  border: "#e5e5e5",
} as const;
