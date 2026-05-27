export const PROJECT_ACCESS_PRESETS = [
  "WordPress admin",
  "Hosting / cPanel",
  "Domain registrar",
  "FTP / SFTP",
  "API key",
  "Google Analytics",
  "Google Search Console",
  "Google Business Profile",
  "Email / webmail",
  "DNS provider",
  "Social media account",
  "E-commerce platform",
  "Other",
] as const;

export type ProjectAccessPreset = (typeof PROJECT_ACCESS_PRESETS)[number];

export type DealAccessFormValues = {
  label: string;
  url: string;
  username: string;
  password: string;
  notes: string;
};

export const emptyDealAccessFormValues = (): DealAccessFormValues => ({
  label: "",
  url: "",
  username: "",
  password: "",
  notes: "",
});

export const normalizeAccessUrl = (url?: string | null) => {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};
