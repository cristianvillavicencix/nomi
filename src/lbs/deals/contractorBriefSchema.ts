import type { FormFieldDef, FormSectionDef } from "@/lbs/forms-v2/types";

const CONTRACTOR_BRIEF_TYPES = new Set([
  "website",
  "new-website",
  "redesign",
  "landing-page",
  "ecommerce",
]);

export const usesContractorBriefForm = (projectType?: string | null) =>
  CONTRACTOR_BRIEF_TYPES.has(projectType || "website");

const field = (def: FormFieldDef): FormFieldDef => def;

const whenEquals = (fieldKey: string, value: string) => ({
  operator: "and" as const,
  conditions: [{ field: fieldKey, op: "equals" as const, value }],
});

const whenContains = (fieldKey: string, value: string) => ({
  operator: "and" as const,
  conditions: [{ field: fieldKey, op: "contains" as const, value }],
});

export const CONTRACTOR_BRIEF_SECTIONS: FormSectionDef[] = [
  {
    id: "confirm_data",
    title: "Confirm your details",
    description:
      "Review what we already have on file and fill in anything that's missing.",
    fields: [
      field({
        key: "contact_name",
        type: "text",
        label: "Contact name",
        required: true,
      }),
      field({
        key: "contact_email",
        type: "email",
        label: "Contact email",
        required: true,
      }),
      field({
        key: "contact_phone",
        type: "phone",
        label: "Contact phone",
        required: true,
      }),
      field({
        key: "company_name",
        type: "text",
        label: "Company name",
        required: true,
      }),
      field({
        key: "use_same_contact_for_business",
        type: "checkbox",
        label: "Use the same email and phone for the business",
      }),
      field({
        key: "business_email",
        type: "email",
        label: "Business email",
        visible_when: {
          operator: "and",
          conditions: [
            {
              field: "use_same_contact_for_business",
              op: "is_empty",
            },
          ],
        },
      }),
      field({
        key: "business_phone",
        type: "phone",
        label: "Business phone",
        visible_when: {
          operator: "and",
          conditions: [
            {
              field: "use_same_contact_for_business",
              op: "is_empty",
            },
          ],
        },
      }),
      field({
        key: "full_address",
        type: "textarea",
        label: "Full business address",
        required: true,
      }),
      field({
        key: "existing_website",
        type: "text",
        label: "Current website (if any)",
        placeholder: "www.yourcompany.com",
      }),
      field({
        key: "social_links",
        type: "dynamic_list",
        label: "Social media",
        min_items: 0,
        add_button_label: "Add social profile",
        item_label_template: "Social profile {index}",
        item_placeholder: "e.g. Facebook|facebook.com/yourcompany",
        help_text:
          "Optional. Add each profile you use (Facebook, Instagram, etc.).",
      }),
    ],
  },
  {
    id: "about_business",
    title: "About your business",
    fields: [
      field({
        key: "company_founded_year",
        type: "number",
        label: "Year the company was founded",
        min: 1900,
        max: new Date().getFullYear(),
      }),
      field({
        key: "years_experience",
        type: "number",
        label: "Years of experience (calculated)",
        help_text: "Calculated automatically from the founding year.",
      }),
      field({
        key: "has_insurance",
        type: "radio",
        label: "Do you carry insurance?",
        options: ["Yes", "No"],
      }),
      field({
        key: "license_number",
        type: "text",
        label: "License number",
        visible_when: whenEquals("has_insurance", "Yes"),
      }),
      field({
        key: "service_areas",
        type: "textarea",
        label: "Service areas / cities you work in",
      }),
      field({
        key: "business_hours",
        type: "textarea",
        label: "Business hours",
      }),
    ],
  },
  {
    id: "web_content",
    title: "Story & website content",
    description:
      "This helps us write your About, homepage, and trust sections.",
    fields: [
      field({
        key: "company_story",
        type: "textarea",
        label: "Company story",
        help_text:
          "How the business started, who founded it, milestones, and what makes you unique today.",
        placeholder:
          "e.g. We started in 2010 as a two-person family team and now serve the whole county…",
      }),
      field({
        key: "company_tagline",
        type: "text",
        label: "Tagline or main headline",
        placeholder:
          'e.g. "Quality in every project" or "Your home, our priority"',
      }),
      field({
        key: "why_choose_us",
        type: "textarea",
        label: "Why should customers choose you?",
        help_text:
          "3–5 clear reasons for a new visitor (experience, warranty, speed, etc.).",
      }),
      field({
        key: "certifications_awards",
        type: "textarea",
        label: "Certifications, awards, or memberships",
        placeholder:
          "e.g. License #12345, BBB A+, NARI member, Best of 2024…",
      }),
      field({
        key: "warranties_guarantees",
        type: "textarea",
        label: "Warranties you offer",
        placeholder:
          "e.g. 10-year materials warranty, 2-year workmanship…",
      }),
      field({
        key: "emergency_services",
        type: "radio",
        label: "Do you offer emergency or after-hours service?",
        options: ["Yes, 24/7", "Yes, emergencies only", "No"],
      }),
    ],
  },
  {
    id: "services",
    title: "Your services",
    fields: [
      field({
        key: "services_offered",
        type: "multi_select",
        label: "Services offered",
        options: [
          "Roof Repairs",
          "Roof Replacements",
          "Chimney Repairs",
          "Siding Repairs",
          "Siding Replacements",
          "Vinyl Siding Installation",
          "Deck Repairs",
          "Deck Replacements",
          "New Deck Construction",
          "Composite Decking (Trex)",
          "Railing Systems",
          "Gutter Cleaning",
          "Gutter Repairs",
          "Gutter Replacements",
          "Gutter Installation",
          "Exterior Painting",
          "Interior Painting",
          "Power Washing",
          "Exterior Renovations",
          "General Home Improvements",
          "Other",
        ],
      }),
      field({
        key: "other_services",
        type: "text",
        label: "Other services",
        visible_when: whenContains("services_offered", "Other"),
      }),
      field({
        key: "primary_service",
        type: "text",
        label: "Primary / most profitable service",
        help_text: "Pick one of the services you selected above.",
      }),
      field({
        key: "free_offers",
        type: "multi_select",
        label: "Do you offer free inspections or estimates?",
        options: [
          "Free inspection",
          "Free estimate",
          "Both",
          "Neither",
        ],
      }),
      field({
        key: "insurance_claims",
        type: "radio",
        label: "Do you work with insurance claims?",
        options: ["Yes", "No"],
      }),
      field({
        key: "accepts_xactimate",
        type: "radio",
        label: "Do you accept Xactimate?",
        options: ["Yes", "No"],
        visible_when: whenEquals("insurance_claims", "Yes"),
      }),
      field({
        key: "differentiators",
        type: "textarea",
        label: "What makes you different from competitors?",
        help_text: "We suggest 3–5 reasons.",
      }),
    ],
  },
  {
    id: "contact_preferences",
    title: "How customers should reach you",
    fields: [
      field({
        key: "preferred_contact_methods",
        type: "multi_select",
        label: "Preferred contact methods",
        options: [
          "Phone call",
          "SMS / text",
          "WhatsApp",
          "Website form",
          "Email",
        ],
      }),
      field({
        key: "form_notification_email",
        type: "email",
        label: "Email to receive website form submissions",
      }),
      field({
        key: "whatsapp_business",
        type: "phone",
        label: "WhatsApp Business number",
      }),
    ],
  },
  {
    id: "visual_content",
    title: "Visual content",
    fields: [
      field({
        key: "logo_file",
        type: "file",
        label: "Logo",
        accept: ".jpg,.jpeg,.png,.webp,.svg",
      }),
      field({
        key: "has_project_photos",
        type: "radio",
        label: "Do you have photos of completed projects?",
        options: [
          "Yes, I'll upload now",
          "No, use professional stock photos",
        ],
      }),
      field({
        key: "before_after_photos",
        type: "radio",
        label: "Do you have before & after photos?",
        options: ["Yes", "No"],
      }),
      field({
        key: "has_team_photos",
        type: "radio",
        label: "Do you have team / truck / uniform photos?",
        options: ["Yes", "No"],
      }),
    ],
  },
  {
    id: "language_audience",
    title: "Site language & audience",
    fields: [
      field({
        key: "site_language",
        type: "radio",
        label: "Website language",
        options: ["English", "Spanish", "Bilingual (both)"],
      }),
      field({
        key: "target_customers",
        type: "multi_select",
        label: "Typical customer",
        options: ["Homeowners", "Property managers", "Commercial", "Other"],
      }),
      field({
        key: "target_customers_other",
        type: "text",
        label: "Other customer type",
        visible_when: whenContains("target_customers", "Other"),
      }),
    ],
  },
  {
    id: "brand_style",
    title: "Brand & style",
    fields: [
      field({
        key: "brand_colors_option",
        type: "radio",
        label: "Do you have specific brand colors?",
        options: ["Yes", "No, use colors from the logo"],
      }),
      field({
        key: "brand_color_1",
        type: "text",
        label: "Primary color",
        visible_when: whenEquals("brand_colors_option", "Yes"),
      }),
      field({
        key: "brand_color_2",
        type: "text",
        label: "Secondary color",
        visible_when: whenEquals("brand_colors_option", "Yes"),
      }),
      field({
        key: "brand_color_3",
        type: "text",
        label: "Accent color",
        visible_when: whenEquals("brand_colors_option", "Yes"),
      }),
      field({
        key: "reference_sites",
        type: "dynamic_list",
        label: "Reference websites",
        min_items: 0,
        add_button_label: "Add reference site",
        item_placeholder: "www.example.com",
      }),
      field({
        key: "site_exclusions",
        type: "textarea",
        label: "Anything you do NOT want on your site?",
      }),
    ],
  },
  {
    id: "extras",
    title: "Extras",
    fields: [
      field({
        key: "wants_blog",
        type: "radio",
        label: "Do you want a blog on your site?",
        options: ["Yes", "No"],
      }),
      field({
        key: "client_notes",
        type: "textarea",
        label: "Additional notes",
      }),
      field({
        key: "brief_confirmation",
        type: "checkbox",
        label:
          "I confirm the information provided is accurate and authorize its use for my website project.",
        required: true,
      }),
    ],
  },
];

export const getVisibleContractorBriefSections = (
  _projectType?: string | null,
) => CONTRACTOR_BRIEF_SECTIONS;

/** JSON schema stored on form_templates / form_instances for project_brief. */
export const CONTRACTOR_BRIEF_FORM_SCHEMA = {
  sections: CONTRACTOR_BRIEF_SECTIONS,
};
