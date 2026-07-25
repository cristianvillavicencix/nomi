export type HostingerDomain = {
  id: number;
  org_id: number;
  hostinger_id?: number | null;
  domain: string;
  domain_type?: string | null;
  status: string;
  expires_at?: string | null;
  registered_at?: string | null;
  is_locked?: boolean | null;
  is_privacy_protected?: boolean | null;
  company_id?: number | null;
  company_name?: string | null;
  is_owned?: boolean;
  metadata?: Record<string, unknown>;
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type HostingerDomainFilter =
  | "all"
  | "clients"
  | "active"
  | "expiring_14"
  | "expiring_30"
  | "expiring_60"
  | "expiring_90"
  | "expired"
  | "unlinked";

export type HostingerOverviewStats = {
  total: number;
  clients: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  unlinked: number;
  active: number;
};

export type HostingerDnsRecord = {
  name?: string | null;
  type?: string | null;
  ttl?: number | null;
  records?: Array<{
    content?: string | null;
    is_disabled?: boolean | null;
  }> | null;
};

export type HostingerDomainExtended = {
  domain?: string | null;
  status?: string | null;
  type?: string | null;
  expires_at?: string | null;
  registered_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_locked?: boolean | null;
  is_privacy_protected?: boolean | null;
  is_lockable?: boolean | null;
  is_privacy_protection_allowed?: boolean | null;
  name_servers?: { ns1?: string; ns2?: string } | null;
  message?: string | null;
};

export type HostingerMailMailbox = {
  resource_id?: string | null;
  address?: string | null;
};

export type HostingerDomainDetails = {
  ok?: boolean;
  domain: string;
  cached?: HostingerDomain | null;
  details?: HostingerDomainExtended | null;
  dns_records?: HostingerDnsRecord[];
  dns_error?: string | null;
  mailboxes?: HostingerMailMailbox[];
  mail_error?: string | null;
  has_mail_api_token?: boolean;
};
