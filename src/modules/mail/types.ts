export type MailProvider = "google" | "microsoft" | "imap";

export type MailAccountStatus =
  | "pending"
  | "connected"
  | "error"
  | "disabled"
  | "needs_reconnect";

export type MailAccount = {
  id: number;
  org_id: number;
  owner_member_id: number | null;
  provider: MailProvider;
  email: string;
  display_name: string | null;
  status: MailAccountStatus;
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type MailThread = {
  id: number;
  account_id: number;
  org_id: number;
  provider_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: Array<{ email?: string; name?: string }>;
  last_message_at: string | null;
  is_unread: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_archived: boolean;
  is_trashed: boolean;
  message_count: number;
};

export type MailMessage = {
  id: number;
  thread_id: number;
  account_id: number;
  provider_message_id: string;
  direction: "inbound" | "outbound";
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  sent_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  send_status: "pending" | "sent" | "failed" | null;
};

export type MailLabel = {
  id: number;
  account_id: number;
  name: string;
  color: string | null;
};
