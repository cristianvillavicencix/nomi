import { supabaseAdmin } from "./supabaseAdmin.ts";
import { contactHasPhone, normalizeUsPhoneToE164 } from "./phone.ts";

export async function findClientConversation(
  orgId: number,
  externalPhone: string,
) {
  const normalized = normalizeUsPhoneToE164(externalPhone);
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("type", "client")
    .eq("external_phone", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to find client conversation");
  }

  return data;
}

export async function findContactByPhone(orgId: number, externalPhone: string) {
  const normalized = normalizeUsPhoneToE164(externalPhone);
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin.rpc("find_contact_by_phone", {
    p_org_id: orgId,
    p_phone: normalized,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to find contact by phone");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function ensureClientConversation(params: {
  orgId: number;
  externalPhone: string;
  contactId?: number | null;
  dealId?: number | null;
  createdByMemberId?: number | null;
  title?: string | null;
}) {
  const normalized = normalizeUsPhoneToE164(params.externalPhone);
  if (!normalized) {
    throw new Error("Invalid client phone number");
  }

  const existing = await findClientConversation(params.orgId, normalized);
  if (existing) return existing;

  let contactId = params.contactId ?? null;
  let title = params.title?.trim() || null;

  if (contactId) {
    const { data: contact, error } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, phone_jsonb, company_id")
      .eq("id", contactId)
      .eq("org_id", params.orgId)
      .maybeSingle();

    if (error || !contact) {
      throw new Error("Contact not found");
    }

    if (!contactHasPhone(contact.phone_jsonb, normalized)) {
      throw new Error("Selected contact does not use this phone number");
    }

    title =
      title ||
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      normalized;
  } else {
    const matchedContact = await findContactByPhone(params.orgId, normalized);
    if (matchedContact) {
      contactId = matchedContact.id;
      title =
        title ||
        `${matchedContact.first_name ?? ""} ${matchedContact.last_name ?? ""}`.trim() ||
        normalized;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      org_id: params.orgId,
      type: "client",
      title: title || normalized,
      contact_id: contactId,
      deal_id: params.dealId ?? null,
      external_phone: normalized,
      created_by_member_id: params.createdByMemberId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const retry = await findClientConversation(params.orgId, normalized);
      if (retry) return retry;
    }
    throw new Error(error.message ?? "Failed to create client conversation");
  }

  return data;
}

export async function deleteConversationIfEmpty(conversationId: number) {
  const { count, error: countError } = await supabaseAdmin
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (countError) {
    throw new Error(
      countError.message ?? "Failed to inspect conversation messages",
    );
  }

  if ((count ?? 0) > 0) {
    return false;
  }

  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message ?? "Failed to delete empty conversation");
  }

  return true;
}

export async function insertSmsMessage(params: {
  conversationId: number;
  body: string;
  direction: "inbound" | "outbound";
  authorMemberId?: number | null;
  externalId?: string | null;
  mediaUrl?: string | null;
  isInternalNote?: boolean;
  replyToMessageId?: number | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("conversation_messages")
    .insert({
      conversation_id: params.conversationId,
      body: params.body,
      channel: "sms",
      direction: params.direction,
      author_member_id: params.authorMemberId ?? null,
      external_id: params.externalId ?? null,
      media_url: params.mediaUrl ?? null,
      is_internal_note: params.isInternalNote === true,
      reply_to_message_id: params.replyToMessageId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message ?? "Failed to save SMS message");
  }

  return data;
}

export async function touchConversationFirstResponse(
  conversationId: number,
  respondedAt: string,
) {
  await supabaseAdmin
    .from("conversations")
    .update({ first_response_at: respondedAt })
    .eq("id", conversationId)
    .is("first_response_at", null);
}

export async function assertMemberCanAccessConversation(
  memberId: number,
  orgId: number,
  conversationId: number,
) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("id, org_id, type")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Conversation not found");
  }

  if (Number(data.org_id) !== orgId) {
    throw new Error("Conversation not found");
  }

  if (data.type !== "client") {
    throw new Error("Only client SMS conversations can be sent through Twilio");
  }

  return data;
}
