import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  authenticateMailMember,
  memberHasCapability,
} from "../_shared/mailAccount.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const PRESETS: Record<
  string,
  { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }
> = {
  "gmail.com": {
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
  },
  "googlemail.com": {
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
  },
  "outlook.com": {
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
  },
  "hotmail.com": {
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
  },
  "live.com": {
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
  },
  "yahoo.com": {
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: 465,
  },
};

/** Hostinger-style hosting (custom domains often use these hosts). */
const HOSTINGER_PRESET = {
  imap_host: "imap.hostinger.com",
  imap_port: 993,
  smtp_host: "smtp.hostinger.com",
  smtp_port: 465,
};

async function probeTcp(host: string, port: number, timeoutMs = 8000) {
  const conn = await Promise.race([
    Deno.connect({ hostname: host, port }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), timeoutMs)
    ),
  ]);
  try {
    conn.close();
  } catch {
    /* ignore */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticateMailMember(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  if (auth.member.user_id === "service_role") {
    return json({ error: "Use a user token" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const scope = body.scope as "org" | "personal";
  if (scope !== "org" && scope !== "personal") {
    return json({ error: "Invalid scope" }, 400);
  }

  const manageCap =
    scope === "org" ? "mail.org.manage" : "mail.personal.manage";
  if (
    !memberHasCapability(auth.member, manageCap) &&
    !auth.member.administrator
  ) {
    return json({ error: "Forbidden" }, 403);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return json({ error: "email and password required" }, 400);
  }

  const domain = email.split("@")[1] || "";
  const hint = String(body.mail_provider || "").toLowerCase();
  const preset = hint === "hostinger" ? HOSTINGER_PRESET : PRESETS[domain];
  const imapHost = String(body.imap_host || preset?.imap_host || "").trim();
  const imapPort = Number(body.imap_port || preset?.imap_port || 993);
  const smtpHost = String(body.smtp_host || preset?.smtp_host || "").trim();
  const smtpPort = Number(body.smtp_port || preset?.smtp_port || 465);

  if (!imapHost) {
    return json(
      { error: "IMAP host required (could not auto-detect from domain)" },
      400,
    );
  }

  try {
    await probeTcp(imapHost, imapPort);
    if (smtpHost) await probeTcp(smtpHost, smtpPort);
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error
            ? `Could not reach mail server: ${e.message}`
            : "Connection test failed",
      },
      400,
    );
  }

  if (action === "test") {
    return json({
      ok: true,
      imap_host: imapHost,
      imap_port: imapPort,
      smtp_host: smtpHost || null,
      smtp_port: smtpPort || null,
    });
  }

  if (action !== "connect") {
    return json({ error: "Unknown action" }, 400);
  }

  const ownerMemberId = scope === "personal" ? auth.member.id : null;
  const tokenPayload = {
    password,
    username: String(body.imap_username || email),
  };

  const { data: existing } = await supabaseAdmin
    .from("mail_accounts")
    .select("id")
    .eq("org_id", auth.member.org_id)
    .ilike("email", email)
    .is("owner_member_id", ownerMemberId)
    .maybeSingle();

  let accountId = existing?.id as number | undefined;
  const row = {
    provider: "imap" as const,
    email,
    display_name: body.display_name ? String(body.display_name) : null,
    status: "connected",
    token_payload: tokenPayload,
    imap_host: imapHost,
    imap_port: imapPort,
    imap_security: "ssl",
    imap_username: String(body.imap_username || email),
    smtp_host: smtpHost || null,
    smtp_port: smtpPort || null,
    smtp_security: smtpPort === 587 ? "starttls" : "ssl",
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  if (accountId) {
    await supabaseAdmin.from("mail_accounts").update(row).eq("id", accountId);
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("mail_accounts")
      .insert({
        ...row,
        org_id: auth.member.org_id,
        owner_member_id: ownerMemberId,
        created_by_member_id: auth.member.id,
      })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);
    accountId = inserted.id;
  }

  return json({ ok: true, account_id: accountId });
});
