export type SendFormContextType =
  | "contact"
  | "company"
  | "deal"
  | "lead"
  | "conversation";

export type SendFormContext = {
  type: SendFormContextType;
  contact_id?: number;
  company_id?: number;
  deal_id?: number;
  conversation_id?: number;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  resourceName?: string;
};

export type SendFormButtonVariant = "button" | "icon" | "menu-item";
