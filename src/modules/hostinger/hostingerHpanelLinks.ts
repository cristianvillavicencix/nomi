export const HOSTINGER_HPANEL_BASE = "https://hpanel.hostinger.com";

export const getHostingerHpanelHomeUrl = () => HOSTINGER_HPANEL_BASE;

export const getHostingerDomainsUrl = () =>
  `${HOSTINGER_HPANEL_BASE}/domains`;

export const getHostingerDomainManageUrl = (domain: string) =>
  `${HOSTINGER_HPANEL_BASE}/domain/${encodeURIComponent(domain)}/domain-overview/`;

export const getHostingerDomainDnsUrl = (domain: string) =>
  `${HOSTINGER_HPANEL_BASE}/domain/${encodeURIComponent(domain)}/dns`;

export const getHostingerApiTokenUrl = () =>
  `${HOSTINGER_HPANEL_BASE}/profile/api`;

export const getHostingerDomainMailboxesUrl = (domain: string) =>
  `${HOSTINGER_HPANEL_BASE}/email/${encodeURIComponent(domain)}/mailboxes`;
