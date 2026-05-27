-- Email OTP for client portal sensitive sessions (credential reveal/copy).

alter table public.client_portal_sensitive_sessions
  add column if not exists otp_code_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_sent_at timestamptz,
  add column if not exists otp_attempts int not null default 0;

