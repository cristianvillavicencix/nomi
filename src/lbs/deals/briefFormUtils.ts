const CURRENT_YEAR = new Date().getFullYear();

export const normalizeFlexibleUrl = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw.replace(/^\/+/, "")}`;
};

export const isFlexibleUrl = (value: unknown): boolean => {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  try {
    new URL(normalizeFlexibleUrl(raw));
    return true;
  } catch {
    return /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw);
  }
};

export const computeYearsExperience = (foundedYear: unknown): number | null => {
  const year = Number(foundedYear);
  if (!Number.isFinite(year) || year < 1900 || year > CURRENT_YEAR) return null;
  return Math.max(0, CURRENT_YEAR - year);
};

const URL_ANSWER_KEYS = new Set(["existing_website"]);

export const enrichBriefAnswers = (
  answers: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...answers };

  if (next.use_same_contact_for_business === true) {
    if (next.contact_email) next.business_email = next.contact_email;
    if (next.contact_phone) next.business_phone = next.contact_phone;
  }

  const years = computeYearsExperience(next.company_founded_year);
  if (years != null) {
    next.years_experience = years;
  }

  for (const key of URL_ANSWER_KEYS) {
    const normalized = normalizeFlexibleUrl(next[key]);
    if (normalized) next[key] = normalized;
  }

  if (Array.isArray(next.social_links)) {
    next.social_links = next.social_links
      .map((entry) => {
        if (typeof entry !== "string") return null;
        const [platform, url] = entry.split("|");
        if (!url?.trim()) return null;
        return `${platform}|${normalizeFlexibleUrl(url)}`;
      })
      .filter(Boolean);
  }

  if (Array.isArray(next.reference_sites)) {
    next.reference_sites = next.reference_sites
      .map((entry) => normalizeFlexibleUrl(entry))
      .filter(Boolean);
  }

  return next;
};

export const CONTRACTOR_BRIEF_ANSWER_KEYS = new Set([
  "project_type",
  "contact_name",
  "contact_email",
  "contact_phone",
  "company_name",
  "use_same_contact_for_business",
  "business_email",
  "business_phone",
  "full_address",
  "existing_website",
  "social_links",
  "certifications",
  "company_founded_year",
  "years_experience",
  "has_insurance",
  "license_number",
  "service_areas",
  "business_hours",
  "company_story",
  "company_tagline",
  "why_choose_us",
  "certifications_awards",
  "warranties_guarantees",
  "emergency_services",
  "services_offered",
  "other_services",
  "primary_service",
  "free_offers",
  "insurance_claims",
  "accepts_xactimate",
  "differentiators",
  "preferred_contact_methods",
  "form_notification_email",
  "whatsapp_business",
  "logo_file",
  "has_project_photos",
  "service_project_photos",
  "before_after_photos",
  "service_before_photos",
  "service_after_photos",
  "has_team_photos",
  "team_photos_files",
  "site_language",
  "target_customers",
  "target_customers_other",
  "brand_colors_option",
  "brand_color_1",
  "brand_color_2",
  "brand_color_3",
  "reference_sites",
  "site_exclusions",
  "wants_blog",
  "client_notes",
  "brief_confirmation",
]);

export const sanitizeBriefAnswersForSubmit = (
  answers: Record<string, unknown>,
): Record<string, unknown> => {
  const enriched = enrichBriefAnswers(answers);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(enriched)) {
    if (!CONTRACTOR_BRIEF_ANSWER_KEYS.has(key)) continue;
    if (value === "" || value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    sanitized[key] = value;
  }

  return sanitized;
};
