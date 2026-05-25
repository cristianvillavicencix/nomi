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
  | "signature";

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
  visible_when?: Record<string, string | string[]>;
};

export type FormSectionDef = {
  id: string;
  title?: string;
  description?: string;
  fields: FormFieldDef[];
  visible_when?: Record<string, string | string[]>;
};

export type FormSchemaV2 = {
  sections?: FormSectionDef[];
};

export type PublicFormPayload = {
  token: string;
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
    recaptcha_enabled?: boolean;
    honeypot_enabled?: boolean;
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
  submitted_at?: string;
  created_at?: string;
};

export type FormInstance = {
  id: number;
  org_id?: number;
  template_id?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  schema?: FormSchemaV2;
  is_active?: boolean;
};

export type PublicFormToken = {
  id: number;
  token: string;
  form_instance_id: number;
  deal_id?: number | null;
  created_at?: string;
};
