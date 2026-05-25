import type { FormFieldType } from "@/lbs/forms-v2/types";

export type PaletteItem = {
  type: FormFieldType | "section" | "heading" | "divider";
  label: string;
  category: "basic" | "choice" | "advanced" | "layout";
  icon?: string;
};

export const FIELD_PALETTE: PaletteItem[] = [
  { type: "text", label: "Text", category: "basic" },
  { type: "textarea", label: "Textarea", category: "basic" },
  { type: "email", label: "Email", category: "basic" },
  { type: "phone", label: "Phone", category: "basic" },
  { type: "number", label: "Number", category: "basic" },
  { type: "url", label: "URL", category: "basic" },
  { type: "date", label: "Date", category: "basic" },
  { type: "select", label: "Dropdown", category: "choice" },
  { type: "radio", label: "Radio", category: "choice" },
  { type: "checkbox", label: "Checkbox", category: "choice" },
  { type: "multi_select", label: "Multi-select", category: "choice" },
  { type: "rating", label: "Rating", category: "advanced" },
  { type: "signature", label: "Signature", category: "advanced" },
  { type: "file", label: "File upload", category: "advanced" },
  { type: "file_multi", label: "Multi-file", category: "advanced" },
  { type: "section", label: "Section", category: "layout" },
  { type: "heading", label: "Heading", category: "layout" },
  { type: "divider", label: "Divider", category: "layout" },
];

export const TEMPLATE_OPTIONS = [
  {
    slug: "project_brief",
    name: "Project Brief",
    description: "For new web projects",
    emoji: "📋",
  },
  {
    slug: "contact",
    name: "Contact Form",
    description: "Capture incoming inquiries",
    emoji: "📞",
  },
  {
    slug: "lead_capture",
    name: "Lead Capture",
    description: "Short lead form",
    emoji: "🎯",
  },
  {
    slug: "quote_request",
    name: "Quote Request",
    description: "Project quote requests",
    emoji: "💰",
  },
  {
    slug: "nps_survey",
    name: "NPS Survey",
    description: "Customer satisfaction",
    emoji: "⭐",
  },
  {
    slug: "job_application",
    name: "Job Application",
    description: "Hiring intake",
    emoji: "💼",
  },
  {
    slug: "generic_survey",
    name: "Generic Survey",
    description: "Flexible survey",
    emoji: "📝",
  },
  {
    slug: "blank",
    name: "Blank form",
    description: "Start from scratch",
    emoji: "✨",
  },
] as const;

export const FORM_TYPE_LABELS: Record<string, string> = {
  project_brief: "Project Brief",
  contact: "Contact",
  lead_capture: "Lead Capture",
  quote_request: "Quote Request",
  nps_survey: "NPS Survey",
  job_application: "Job Application",
  generic_survey: "Survey",
  custom: "Custom",
};

export const PALETTE_CATEGORIES = [
  { id: "basic", label: "Basic" },
  { id: "choice", label: "Choice" },
  { id: "advanced", label: "Advanced" },
  { id: "layout", label: "Layout" },
] as const;
