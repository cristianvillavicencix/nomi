import type {
  ConditionGroup,
  LegacyVisibleWhen,
  VisibleWhen,
} from "@/lib/forms-v2/conditionalLogic";

export type { ConditionGroup, LegacyVisibleWhen, VisibleWhen };

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "multi_select"
  | "rating"
  | "file"
  | "file_multi"
  | "signature"
  | "hidden"
  | "formula";

export type FormulaFormat = "number" | "currency";

export type FormFieldDef = {
  key: string;
  type?: FormFieldType | string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  help_text?: string;
  options?: string[];
  min?: number;
  max?: number;
  labels?: { min?: string; max?: string };
  accept?: string;
  formula?: string;
  format?: FormulaFormat;
  visible_when?: VisibleWhen;
};

export type FormSectionDef = {
  id: string;
  title?: string;
  description?: string;
  fields: FormFieldDef[];
  visible_when?: VisibleWhen;
};

export type FormSchemaSettings = {
  wizard_mode?: "auto" | "on" | "off";
};

export type FormSchemaV2 = {
  sections?: FormSectionDef[];
  settings?: FormSchemaSettings;
};

export type PublicFormPayload = {
  token: string;
  is_preview?: boolean;
  form: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    schema: FormSchemaV2;
    type: string;
    logo_url?: string | null;
    primary_color?: string | null;
    background_image_url?: string | null;
    welcome_title?: string | null;
    welcome_message?: string | null;
    thank_you_title?: string | null;
    thank_you_message?: string | null;
    redirect_url?: string | null;
    recaptcha_enabled?: boolean;
    honeypot_enabled?: boolean;
    custom_font_url?: string | null;
    custom_css?: string | null;
  };
  prefill?: Record<string, unknown>;
  links?: {
    contact_id?: number | null;
    company_id?: number | null;
    deal_id?: number | null;
  };
};

export type FormSubmissionV2 = {
  id: number;
  org_id?: number;
  form_instance_id: number;
  answers?: Record<string, unknown>;
  deal_id?: number | null;
  contact_id?: number | null;
  company_id?: number | null;
  status?: string;
  submitter_email?: string | null;
  submitter_phone?: string | null;
  submitter_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  source_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  reviewed_by_member_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type FormInstance = {
  id: number;
  org_id?: number;
  template_id?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  schema?: FormSchemaV2;
  logo_url?: string | null;
  primary_color?: string | null;
  background_image_url?: string | null;
  welcome_title?: string | null;
  welcome_message?: string | null;
  thank_you_title?: string | null;
  thank_you_message?: string | null;
  redirect_url?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  notify_on_submit?: boolean;
  notify_member_ids?: number[];
  auto_create_contact?: boolean;
  auto_create_lead?: boolean;
  auto_create_task?: boolean;
  task_assignee_member_id?: number | null;
  task_title_template?: string | null;
  expiration_date?: string | null;
  submission_limit?: number | null;
  recaptcha_enabled?: boolean;
  honeypot_enabled?: boolean;
  custom_font_url?: string | null;
  custom_css?: string | null;
  rate_limit_per_ip_per_hour?: number;
};

export type FormTemplate = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  type?: string;
  schema?: FormSchemaV2;
  is_system?: boolean;
};

export type PublicFormToken = {
  id: number;
  token: string;
  form_instance_id: number;
  deal_id?: number | null;
  created_at?: string;
};

export type FormInstanceVersion = {
  id: number;
  form_instance_id: number;
  version_number: number;
  schema?: FormSchemaV2;
  notes?: string | null;
  created_by_member_id?: number | null;
  created_at?: string;
};
