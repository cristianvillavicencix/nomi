/** Brief types shown when sending the project brief to a client. */
export const WEBSITE_BRIEF_SEND_TYPE_CHOICES = [
  { value: "website", label: "New website" },
  { value: "redesign", label: "Website redesign" },
  { value: "landing-page", label: "Landing page" },
  { value: "ecommerce", label: "E-commerce store" },
  { value: "maintenance", label: "Maintenance / hosting only" },
] as const;

export type WebsiteBriefSendType =
  (typeof WEBSITE_BRIEF_SEND_TYPE_CHOICES)[number]["value"];

export const getWebsiteBriefSendTypeLabel = (value?: string | null) =>
  WEBSITE_BRIEF_SEND_TYPE_CHOICES.find((entry) => entry.value === value)
    ?.label ??
  value?.replace(/-/g, " ") ??
  "Project brief";
