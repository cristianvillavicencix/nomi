export type PortalProject = {
  id: number;
  name: string;
  stage?: string;
  project_type?: string;
  expected_end_date?: string | null;
  production_url?: string | null;
  staging_url?: string | null;
  created_at?: string | null;
  delivery?: {
    delivered_at?: string;
    site_url?: string | null;
    delivery_date?: string | null;
  } | null;
};

export type PortalDelivery = {
  id: number;
  delivered_at: string;
  site_url?: string | null;
  plan_name?: string | null;
  project_start_date?: string | null;
  delivery_date?: string | null;
  hosting_renewal_date?: string | null;
  hosting_status?: string | null;
  site_language?: string | null;
  included_pages?: string[];
  maintenance_plan?: Record<string, unknown>;
  enabled_sections?: string[];
  domain_info?: Record<string, unknown>;
  marketing_info?: Record<string, unknown>;
  onboarding_info?: Record<string, unknown>;
};

export type PortalCredential = {
  id: number;
  label: string;
  kind?: string | null;
  secret_label?: string | null;
  url?: string | null;
  username?: string | null;
  managed_by?: string | null;
  service_kind?: string | null;
  portal_sort_order?: number | null;
  has_password?: boolean | null;
  password_updated_at?: string | null;
};

export type PortalResource = {
  id: number;
  category: string;
  label?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  is_image?: boolean;
  download_url?: string | null;
  preview_url?: string | null;
  created_at?: string | null;
  size_bytes?: number | null;
};

export type PortalDomain = {
  id?: number;
  domain: string;
  registrar?: string | null;
  registered_at?: string | null;
  renewal_date?: string | null;
  managed_by?: string | null;
  auto_renew?: boolean | null;
  dns_servers?: string[];
};

export type PortalCorporateEmail = {
  id: number;
  email: string;
  config_notes?: string | null;
  has_password?: boolean | null;
};

export type PortalNotification = {
  id: number;
  deal_id: number;
  delivery_id?: number | null;
  title: string;
  body?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

export type PortalPayload = {
  account?: { email?: string };
  projects?: PortalProject[];
  project?: PortalProject;
  delivery?: PortalDelivery | null;
  credentials?: PortalCredential[];
  resources?: PortalResource[];
  domains?: PortalDomain[];
  corporate_emails?: PortalCorporateEmail[];
  approvals?: Array<Record<string, unknown>>;
  notifications?: PortalNotification[];
};

export type PortalView =
  | "general"
  | "credentials"
  | "corporate_email"
  | "domain_dns"
  | "files"
  | "marketing_seo"
  | "training"
  | "support";

export const DEFAULT_INCLUDED_PAGES = [
  "Home",
  "Servicios",
  "Galería",
  "Antes y Después",
  "Sobre Nosotros",
  "Contacto",
];

export const isDeliveryNew = (deliveredAt?: string | null) => {
  if (!deliveredAt) return false;
  const delivered = new Date(deliveredAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - delivered < sevenDaysMs;
};

export const formatPortalDate = (
  value?: string | null,
  locale = "es-US",
) => {
  if (!value) return "—";
  const date = new Date(`${value.includes("T") ? value : `${value}T12:00:00`}`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const developmentDurationDays = (
  start?: string | null,
  end?: string | null,
) => {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diff = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff >= 0 ? diff : null;
};
