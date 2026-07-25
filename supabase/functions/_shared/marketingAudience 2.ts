import { supabaseAdmin } from "./supabaseAdmin.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";

export type MarketingAudienceFilter = {
  statuses?: string[];
  tags?: string[];
  require_sms_opt_in?: boolean;
  require_email_opt_in?: boolean;
};

type ContactRow = {
  id: number;
  org_id: number;
  status: string | null;
  tags: string[] | null;
  has_newsletter: boolean | null;
  phone_jsonb: unknown;
  email_jsonb: unknown;
};

const extractPrimaryPhone = (phoneJsonb: unknown): string | null => {
  if (!Array.isArray(phoneJsonb)) return null;
  for (const entry of phoneJsonb) {
    if (!entry || typeof entry !== "object") continue;
    const number = (entry as { number?: string }).number;
    if (typeof number === "string" && number.trim()) {
      const normalized = normalizeUsPhoneToE164(number);
      if (normalized) return normalized;
    }
  }
  return null;
};

const extractPrimaryEmail = (emailJsonb: unknown): string | null => {
  if (!Array.isArray(emailJsonb)) return null;
  for (const entry of emailJsonb) {
    if (!entry || typeof entry !== "object") continue;
    const email = (entry as { email?: string }).email;
    if (typeof email === "string" && email.includes("@")) {
      return email.trim().toLowerCase();
    }
  }
  return null;
};

const matchesAudienceFilter = (
  contact: ContactRow,
  filter: MarketingAudienceFilter,
  channel: "sms" | "email",
): boolean => {
  const statuses = filter.statuses?.filter(Boolean) ?? [];
  if (statuses.length > 0) {
    const status = (contact.status ?? "").trim().toLowerCase();
    if (!statuses.map((s) => s.toLowerCase()).includes(status)) {
      return false;
    }
  }

  const tags = filter.tags?.filter(Boolean) ?? [];
  if (tags.length > 0) {
    const contactTags = contact.tags ?? [];
    const hasTag = tags.some((tag) => contactTags.includes(tag));
    if (!hasTag) return false;
  }

  return true;
};

export async function loadMarketingPreferencesByContactIds(
  orgId: number,
  contactIds: number[],
) {
  if (contactIds.length === 0) return new Map<number, Record<string, unknown>>();

  const { data, error } = await supabaseAdmin
    .from("contact_marketing_preferences")
    .select("*")
    .eq("org_id", orgId)
    .in("contact_id", contactIds);

  if (error) {
    throw new Error(error.message ?? "Failed to load marketing preferences");
  }

  const map = new Map<number, Record<string, unknown>>();
  for (const row of data ?? []) {
    map.set(Number(row.contact_id), row as Record<string, unknown>);
  }
  return map;
}

export async function loadSmsSuppressions(orgId: number, phones: string[]) {
  if (phones.length === 0) return new Set<string>();

  const { data, error } = await supabaseAdmin
    .from("sms_marketing_suppressions")
    .select("phone_e164")
    .eq("org_id", orgId)
    .in("phone_e164", phones);

  if (error) {
    throw new Error(error.message ?? "Failed to load SMS suppressions");
  }

  return new Set((data ?? []).map((row) => String(row.phone_e164)));
}

const isSmsOptedIn = (
  contact: ContactRow,
  prefs: Record<string, unknown> | undefined,
  requireOptIn: boolean,
): boolean => {
  if (prefs?.sms_marketing_opt_out_at) return false;
  if (!requireOptIn) return true;
  return Boolean(prefs?.sms_marketing_opt_in_at);
};

const isEmailOptedIn = (
  contact: ContactRow,
  prefs: Record<string, unknown> | undefined,
  requireOptIn: boolean,
): boolean => {
  if (prefs?.email_marketing_opt_out_at) return false;
  if (!requireOptIn) return true;
  if (prefs?.email_marketing_opt_in_at) return true;
  return contact.has_newsletter === true;
};

export type AudiencePlanResult = {
  total: number;
  pending: number;
  skipped: number;
  skipped_suppressed: number;
  skipped_not_opted_in: number;
  matched_contacts: number;
};

const planSmsAudience = async (
  orgId: number,
  filter: MarketingAudienceFilter,
): Promise<AudiencePlanResult> => {
  const requireOptIn = filter.require_sms_opt_in !== false;

  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, status, tags, has_newsletter, phone_jsonb, email_jsonb")
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load contacts");
  }

  const eligible = (contacts ?? []).filter((contact) => {
    const row = contact as ContactRow;
    if (!matchesAudienceFilter(row, filter, "sms")) return false;
    return Boolean(extractPrimaryPhone(row.phone_jsonb));
  }) as ContactRow[];

  const prefsMap = await loadMarketingPreferencesByContactIds(
    orgId,
    eligible.map((c) => c.id),
  );

  const phones = eligible
    .map((c) => extractPrimaryPhone(c.phone_jsonb))
    .filter((p): p is string => Boolean(p));
  const suppressed = await loadSmsSuppressions(orgId, phones);

  let pending = 0;
  let skippedSuppressed = 0;
  let skippedNotOptedIn = 0;

  for (const contact of eligible) {
    const phone = extractPrimaryPhone(contact.phone_jsonb);
    if (!phone) continue;

    const prefs = prefsMap.get(contact.id);
    if (suppressed.has(phone)) {
      skippedSuppressed += 1;
      continue;
    }

    if (!isSmsOptedIn(contact, prefs, requireOptIn)) {
      skippedNotOptedIn += 1;
      continue;
    }

    pending += 1;
  }

  const skipped = skippedSuppressed + skippedNotOptedIn;

  return {
    matched_contacts: eligible.length,
    total: pending + skipped,
    pending,
    skipped,
    skipped_suppressed: skippedSuppressed,
    skipped_not_opted_in: skippedNotOptedIn,
  };
};

const planEmailAudience = async (
  orgId: number,
  filter: MarketingAudienceFilter,
): Promise<AudiencePlanResult> => {
  const requireOptIn = filter.require_email_opt_in !== false;

  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, status, tags, has_newsletter, phone_jsonb, email_jsonb")
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load contacts");
  }

  const eligible = (contacts ?? []).filter((contact) => {
    const row = contact as ContactRow;
    if (!matchesAudienceFilter(row, filter, "email")) return false;
    return Boolean(extractPrimaryEmail(row.email_jsonb));
  }) as ContactRow[];

  const prefsMap = await loadMarketingPreferencesByContactIds(
    orgId,
    eligible.map((c) => c.id),
  );

  let pending = 0;
  let skippedNotOptedIn = 0;

  for (const contact of eligible) {
    const email = extractPrimaryEmail(contact.email_jsonb);
    if (!email) continue;

    const prefs = prefsMap.get(contact.id);
    if (!isEmailOptedIn(contact, prefs, requireOptIn)) {
      skippedNotOptedIn += 1;
      continue;
    }

    pending += 1;
  }

  return {
    matched_contacts: eligible.length,
    total: pending + skippedNotOptedIn,
    pending,
    skipped: skippedNotOptedIn,
    skipped_suppressed: 0,
    skipped_not_opted_in: skippedNotOptedIn,
  };
};

export async function estimateSmsAudience(
  orgId: number,
  audienceFilter: MarketingAudienceFilter,
) {
  return planSmsAudience(orgId, audienceFilter ?? {});
}

export async function estimateEmailAudience(
  orgId: number,
  audienceFilter: MarketingAudienceFilter,
) {
  return planEmailAudience(orgId, audienceFilter ?? {});
}

export async function buildSmsCampaignRecipients(params: {
  orgId: number;
  campaignId: number;
  audienceFilter: MarketingAudienceFilter;
}) {
  const filter = params.audienceFilter ?? {};
  const requireOptIn = filter.require_sms_opt_in !== false;

  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, status, tags, has_newsletter, phone_jsonb, email_jsonb")
    .eq("org_id", params.orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load contacts");
  }

  const eligible = (contacts ?? []).filter((contact) => {
    const row = contact as ContactRow;
    if (!matchesAudienceFilter(row, filter, "sms")) return false;
    return Boolean(extractPrimaryPhone(row.phone_jsonb));
  }) as ContactRow[];

  const prefsMap = await loadMarketingPreferencesByContactIds(
    params.orgId,
    eligible.map((c) => c.id),
  );

  const phones = eligible
    .map((c) => extractPrimaryPhone(c.phone_jsonb))
    .filter((p): p is string => Boolean(p));
  const suppressed = await loadSmsSuppressions(params.orgId, phones);

  const recipients: Array<{
    campaign_id: number;
    org_id: number;
    contact_id: number;
    phone_e164: string;
    status: string;
    error_message?: string;
  }> = [];

  let skipped = 0;

  for (const contact of eligible) {
    const phone = extractPrimaryPhone(contact.phone_jsonb);
    if (!phone) continue;

    const prefs = prefsMap.get(contact.id);
    if (suppressed.has(phone)) {
      skipped += 1;
      recipients.push({
        campaign_id: params.campaignId,
        org_id: params.orgId,
        contact_id: contact.id,
        phone_e164: phone,
        status: "skipped",
        error_message: "suppressed",
      });
      continue;
    }

    if (!isSmsOptedIn(contact, prefs, requireOptIn)) {
      skipped += 1;
      recipients.push({
        campaign_id: params.campaignId,
        org_id: params.orgId,
        contact_id: contact.id,
        phone_e164: phone,
        status: "skipped",
        error_message: "not_opted_in",
      });
      continue;
    }

    recipients.push({
      campaign_id: params.campaignId,
      org_id: params.orgId,
      contact_id: contact.id,
      phone_e164: phone,
      status: "pending",
    });
  }

  await supabaseAdmin
    .from("sms_campaign_recipients")
    .delete()
    .eq("campaign_id", params.campaignId);

  if (recipients.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("sms_campaign_recipients")
      .insert(recipients);
    if (insertError) {
      throw new Error(insertError.message ?? "Failed to save SMS recipients");
    }
  }

  const pendingCount = recipients.filter((r) => r.status === "pending").length;

  await supabaseAdmin
    .from("sms_campaigns")
    .update({
      status: pendingCount > 0 ? "ready" : "draft",
      recipient_count: recipients.length,
      skipped_count: skipped,
      sent_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.campaignId)
    .eq("org_id", params.orgId);

  return {
    total: recipients.length,
    pending: pendingCount,
    skipped,
  };
}

export async function buildEmailCampaignRecipients(params: {
  orgId: number;
  campaignId: number;
  audienceFilter: MarketingAudienceFilter;
}) {
  const filter = params.audienceFilter ?? {};
  const requireOptIn = filter.require_email_opt_in !== false;

  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, org_id, status, tags, has_newsletter, phone_jsonb, email_jsonb")
    .eq("org_id", params.orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load contacts");
  }

  const eligible = (contacts ?? []).filter((contact) => {
    const row = contact as ContactRow;
    if (!matchesAudienceFilter(row, filter, "email")) return false;
    return Boolean(extractPrimaryEmail(row.email_jsonb));
  }) as ContactRow[];

  const prefsMap = await loadMarketingPreferencesByContactIds(
    params.orgId,
    eligible.map((c) => c.id),
  );

  const recipients: Array<{
    campaign_id: number;
    org_id: number;
    contact_id: number;
    email: string;
    status: string;
    error_message?: string;
  }> = [];

  let skipped = 0;

  for (const contact of eligible) {
    const email = extractPrimaryEmail(contact.email_jsonb);
    if (!email) continue;

    const prefs = prefsMap.get(contact.id);
    if (!isEmailOptedIn(contact, prefs, requireOptIn)) {
      skipped += 1;
      recipients.push({
        campaign_id: params.campaignId,
        org_id: params.orgId,
        contact_id: contact.id,
        email,
        status: "skipped",
        error_message: "not_opted_in",
      });
      continue;
    }

    recipients.push({
      campaign_id: params.campaignId,
      org_id: params.orgId,
      contact_id: contact.id,
      email,
      status: "pending",
    });
  }

  await supabaseAdmin
    .from("email_campaign_recipients")
    .delete()
    .eq("campaign_id", params.campaignId);

  if (recipients.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("email_campaign_recipients")
      .insert(recipients);
    if (insertError) {
      throw new Error(insertError.message ?? "Failed to save email recipients");
    }
  }

  const pendingCount = recipients.filter((r) => r.status === "pending").length;

  await supabaseAdmin
    .from("email_campaigns")
    .update({
      status: pendingCount > 0 ? "ready" : "draft",
      recipient_count: recipients.length,
      skipped_count: skipped,
      sent_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.campaignId)
    .eq("org_id", params.orgId);

  return {
    total: recipients.length,
    pending: pendingCount,
    skipped,
  };
}

export async function recordSmsMarketingOptOut(params: {
  orgId: number;
  phoneE164: string;
  contactId?: number | null;
  reason?: string;
}) {
  const phone = normalizeUsPhoneToE164(params.phoneE164) ?? params.phoneE164.trim();
  const now = new Date().toISOString();
  const reason = params.reason?.trim() || "stop_reply";

  await supabaseAdmin.from("sms_marketing_suppressions").upsert(
    {
      org_id: params.orgId,
      phone_e164: phone,
      opted_out_at: now,
      reason,
      contact_id: params.contactId ?? null,
    },
    { onConflict: "org_id,phone_e164" },
  );

  if (params.contactId) {
    const { data: existing } = await supabaseAdmin
      .from("contact_marketing_preferences")
      .select("contact_id")
      .eq("contact_id", params.contactId)
      .maybeSingle();

    const row = {
      contact_id: params.contactId,
      org_id: params.orgId,
      phone_e164: phone,
      sms_marketing_opt_out_at: now,
      sms_marketing_opt_out_reason: reason,
      updated_at: now,
    };

    if (existing?.contact_id) {
      await supabaseAdmin
        .from("contact_marketing_preferences")
        .update(row)
        .eq("contact_id", params.contactId);
    } else {
      await supabaseAdmin.from("contact_marketing_preferences").insert(row);
    }
  }
}

export async function recordEmailMarketingOptOut(params: {
  orgId: number;
  contactId: number;
  email: string;
  reason?: string;
}) {
  const now = new Date().toISOString();
  const reason = params.reason?.trim() || "unsubscribe_link";

  const { data: existing } = await supabaseAdmin
    .from("contact_marketing_preferences")
    .select("contact_id")
    .eq("contact_id", params.contactId)
    .maybeSingle();

  const row = {
    contact_id: params.contactId,
    org_id: params.orgId,
    email: params.email.trim().toLowerCase(),
    email_marketing_opt_out_at: now,
    email_marketing_opt_out_reason: reason,
    updated_at: now,
  };

  if (existing?.contact_id) {
    await supabaseAdmin
      .from("contact_marketing_preferences")
      .update(row)
      .eq("contact_id", params.contactId);
  } else {
    await supabaseAdmin.from("contact_marketing_preferences").insert(row);
  }

  await supabaseAdmin
    .from("contacts")
    .update({ has_newsletter: false })
    .eq("id", params.contactId)
    .eq("org_id", params.orgId);
}
