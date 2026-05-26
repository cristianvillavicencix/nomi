export const LBS_LEAD_SOURCE_CHOICES = [
  { id: "Referido", name: "Referido" },
  { id: "Sitio web", name: "Sitio web" },
  { id: "Instagram", name: "Instagram" },
  { id: "Facebook", name: "Facebook" },
  { id: "LinkedIn", name: "LinkedIn" },
  { id: "Google", name: "Google" },
  { id: "Networking", name: "Networking" },
  { id: "Cliente existente", name: "Cliente existente" },
  { id: "Otro", name: "Otro" },
] as const;

export const LBS_LEAD_SOURCE_REFERRAL = "Referido";
export const LBS_LEAD_SOURCE_OTHER = "Otro";

export const isReferralSource = (value?: string | null) =>
  value === LBS_LEAD_SOURCE_REFERRAL;
export const isOtherSource = (value?: string | null) =>
  value === LBS_LEAD_SOURCE_OTHER;
