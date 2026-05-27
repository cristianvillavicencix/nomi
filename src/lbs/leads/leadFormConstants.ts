export const LBS_LEAD_SOURCE_CHOICES = [
  { id: "Google", name: "Google" },
  { id: "Referido", name: "Referido" },
  { id: "WebSite Visit", name: "WebSite Visit" },
  { id: "TikTok", name: "TikTok" },
  { id: "Facebook", name: "Facebook" },
  { id: "Instagram", name: "Instagram" },
  { id: "Llamada en frío", name: "Llamada en frío" },
  { id: "Otro", name: "Otro" },
] as const;

export const LBS_LEAD_SOURCE_REFERRAL = "Referido";
export const LBS_LEAD_SOURCE_OTHER = "Otro";

export const LBS_INTERESTED_SERVICE_CHOICES = [
  { id: "Sitio web", name: "Sitio web" },
  { id: "Google Ads", name: "Google Ads" },
  { id: "SEO", name: "SEO" },
  { id: "Redes sociales", name: "Redes sociales" },
  { id: "Branding", name: "Branding" },
  { id: "Otro", name: "Otro" },
] as const;

export const LBS_COMPANY_INDUSTRY_CHOICES = [
  { id: "landscaping", name: "Landscaping" },
  { id: "roofing", name: "Roofing" },
  { id: "remodeling", name: "Remodeling" },
  { id: "hvac", name: "HVAC" },
  { id: "plumbing", name: "Plumbing" },
  { id: "electrical", name: "Electrical" },
  { id: "painting", name: "Painting" },
  { id: "cleaning", name: "Cleaning" },
  { id: "other", name: "Other" },
] as const;

export const LBS_CONTACT_ROLE_CHOICES = [
  { id: "Owner", name: "Owner" },
  { id: "Manager", name: "Manager" },
  { id: "Secretary", name: "Secretary" },
  { id: "Sales", name: "Sales" },
  { id: "Other", name: "Other" },
] as const;

export const LEAD_EMAIL_TYPES = [
  { id: "Work", name: "Work" },
  { id: "Personal", name: "Personal" },
] as const;

export const LEAD_PHONE_TYPES = [
  { id: "Work", name: "Work" },
  { id: "Mobile", name: "Mobile" },
  { id: "WhatsApp", name: "WhatsApp" },
] as const;

export type LeadType = "individual" | "business";

export const isReferralSource = (value?: string | null) =>
  value === LBS_LEAD_SOURCE_REFERRAL;
export const isOtherSource = (value?: string | null) =>
  value === LBS_LEAD_SOURCE_OTHER;
