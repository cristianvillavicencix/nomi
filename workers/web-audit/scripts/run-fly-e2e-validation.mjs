#!/usr/bin/env node
/**
 * End-to-end validation: Fly worker + hosted Supabase (not local worker).
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://qjglkywmqwqdoaboakao.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@lbs.bz";
const SITE_ID = Number(process.env.TEST_SITE_ID ?? 150);
const HAPPY_AUDIT_URL =
  process.env.TEST_HAPPY_URL ?? "https://www.example.com";
const FLY_APP = process.env.FLY_APP ?? "nomi-web-audit";
const WORKER_URL =
  process.env.WEB_AUDIT_WORKER_URL ?? "https://nomi-web-audit.fly.dev";
const FLY = process.env.FLYCTL ?? `${process.env.HOME}/.fly/bin/flyctl`;

if (!SERVICE_KEY || !ANON) {
  console.error("SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY required");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const pass = (id, detail) => {
  results.push({ id, ok: true, detail });
  console.log(`\n✅ ${id} — ${detail}`);
};
const fail = (id, detail) => {
  results.push({ id, ok: false, detail });
  console.log(`\n❌ ${id} — ${detail}`);
};

const fly = (args) =>
  execSync(`${FLY} ${args} -a ${FLY_APP}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const getJwt = async () => {
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL });
  if (linkError) throw linkError;
  const otp =
    linkData.properties.email_otp ?? linkData.properties.hashed_token;
  const { data, error } = await admin.auth.verifyOtp({
    email: ADMIN_EMAIL,
    token: otp,
    type: "email",
  });
  if (error) throw error;
  return data.session.access_token;
};

const enqueue = async (token, siteId = SITE_ID) => {
  const t0 = Date.now();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/website_audit_enqueue`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ monitored_website_id: siteId }),
    },
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ms: Date.now() - t0 };
};

const waitAudit = async (auditId, targets, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await admin
      .from("website_audits")
      .select("*")
      .eq("id", auditId)
      .single();
    if (data && targets.includes(data.status)) return data;
    await sleep(2000);
  }
  const { data } = await admin
    .from("website_audits")
    .select("*")
    .eq("id", auditId)
    .single();
  return data;
};

const countActive = async (siteId = SITE_ID) => {
  const { count } = await admin
    .from("website_audits")
    .select("id", { count: "exact", head: true })
    .eq("monitored_website_id", siteId)
    .in("status", ["queued", "running"]);
  return count ?? 0;
};

const countFindings = async (auditId) => {
  const { count } = await admin
    .from("audit_findings")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", auditId);
  return count ?? 0;
};

const clearSiteAudits = async (siteId = SITE_ID) => {
  const { data: audits } = await admin
    .from("website_audits")
    .select("id")
    .eq("monitored_website_id", siteId);
  const ids = (audits ?? []).map((a) => a.id);
  if (ids.length) {
    await admin.from("audit_findings").delete().in("audit_id", ids);
    await admin.from("website_audits").delete().in("id", ids);
  }
};

const healthMs = async () => {
  const t0 = Date.now();
  try {
    const r = await fetch(`${WORKER_URL}/health`, {
      signal: AbortSignal.timeout(60_000),
    });
    return { ok: r.ok, ms: Date.now() - t0, status: r.status };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e.message };
  }
};

const stopAllMachines = () => {
  try {
    const ids = fly("machine list --json");
    const machines = JSON.parse(ids);
    for (const m of machines) {
      if (m.state === "started") {
        fly(`machine stop ${m.id} --signal SIGTERM`);
      }
    }
  } catch {
    /* no machines */
  }
};

const ensureOneMachine = async () => {
  fly("scale count 1 --yes");
  await sleep(5000);
};

const swapSiteUrl = async (url) => {
  const { data } = await admin
    .from("monitored_websites")
    .select("url")
    .eq("id", SITE_ID)
    .single();
  const original = data?.url ?? "";
  await admin.from("monitored_websites").update({ url }).eq("id", SITE_ID);
  return original;
};

const restoreSiteUrl = async (original) => {
  if (original) {
    await admin.from("monitored_websites").update({ url: original }).eq("id", SITE_ID);
  }
};

console.log("Fly E2E validation", { WORKER_URL, SITE_ID, FLY_APP });
const token = await getJwt();
const siteUrlOriginal = await swapSiteUrl(HAPPY_AUDIT_URL);

try {
// ─── 0 Happy path ───────────────────────────────────────────────────────────
console.log("\n═══ 0 Happy path ═══");
await clearSiteAudits();
const h0 = await enqueue(token);
const audit0Id = h0.body?.audit?.id;
if (!audit0Id) {
  fail("0", `enqueue failed: ${JSON.stringify(h0.body)}`);
} else {
  const done0 = await waitAudit(audit0Id, ["done", "failed"], 180_000);
  const findings0 = await countFindings(audit0Id);
  const scoresOk =
    done0?.status === "done" &&
    done0.overall_score != null &&
    done0.score_performance != null &&
    done0.score_seo != null &&
    done0.lab_lcp_ms != null;
  if (scoresOk && findings0 > 0) {
    pass(
      "0",
      `done #${audit0Id} overall=${done0.overall_score} perf=${done0.score_performance} seo=${done0.score_seo} LCP=${Math.round(done0.lab_lcp_ms)}ms findings=${findings0} enqueue=${h0.ms}ms`,
    );
  } else if (done0?.status === "done") {
    pass(
      "0 (partial)",
      `done but check nulls: overall=${done0.overall_score} findings=${findings0} err=${done0.error_message}`,
    );
  } else {
    fail(
      "0",
      `status=${done0?.status} err=${done0?.error_message} scores=${JSON.stringify({ o: done0?.overall_score, p: done0?.score_performance })}`,
    );
  }
}

// ─── 1 Cold start (stopped machine = scale-to-zero) ───────────────────────
console.log("\n═══ 1 Cold start ═══");
stopAllMachines();
await sleep(3000);
const coldHealth = await healthMs();
const h1 = await enqueue(token);
const audit1Id = h1.body?.audit?.id;
const done1 = audit1Id
  ? await waitAudit(audit1Id, ["done", "failed"], 180_000)
  : null;
if (
  h1.body?.audit?.status !== "failed" &&
  done1?.status === "done" &&
  h1.ms < 120_000
) {
  pass(
    "1",
    `wake+audit in one click: health_wake=${coldHealth.ms}ms enqueue=${h1.ms}ms → done #${audit1Id}`,
  );
} else {
  fail(
    "1",
    `enqueue=${h1.ms}ms status=${h1.body?.audit?.status} final=${done1?.status} err=${done1?.error_message ?? h1.body?.audit?.error_message}`,
  );
}

// ─── 2 Worker down (scale 0) ──────────────────────────────────────────────
console.log("\n═══ 2 Worker down ═══");
await clearSiteAudits();
try {
  fly("scale count 0 --yes");
} catch (e) {
  console.warn("scale 0:", e.message);
}
await sleep(3000);
const t2 = Date.now();
const h2 = await enqueue(token);
const elapsed2 = Date.now() - t2;
const active2 = await countActive();
if (
  h2.body?.audit?.status === "failed" &&
  String(h2.body?.audit?.error_message ?? "").includes("Worker no disponible") &&
  active2 === 0 &&
  elapsed2 >= 10_000
) {
  pass(
    "2",
    `failed after ~${Math.round(elapsed2 / 1000)}s, 0 active, msg OK`,
  );
} else {
  fail(
    "2",
    `status=${h2.body?.audit?.status} active=${active2} elapsed=${elapsed2}ms msg=${h2.body?.audit?.error_message}`,
  );
}
await ensureOneMachine();

// ─── 3 Worker restart mid-audit + stale sweep ─────────────────────────────
console.log("\n═══ 3 Mid-audit restart + sweep ═══");
await clearSiteAudits();
const h3 = await enqueue(token);
const audit3Id = h3.body?.audit?.id;
if (!audit3Id) {
  fail("3", "no audit created");
} else {
  const running3 = await waitAudit(audit3Id, ["running", "done", "failed"], 90_000);
  if (running3?.status === "running") {
    try {
      fly("apps restart");
      await sleep(5000);
    } catch (e) {
      console.warn("restart:", e.message);
    }
    const { data: still } = await admin
      .from("website_audits")
      .select("status")
      .eq("id", audit3Id)
      .single();
    if (still?.status === "running") {
      await admin
        .from("website_audits")
        .update({ started_at: new Date(Date.now() - 200_000).toISOString() })
        .eq("id", audit3Id);
      const { data: swept } = await admin.rpc("fail_stale_website_audits", {
        max_age_seconds: 60,
      });
      const { data: after } = await admin
        .from("website_audits")
        .select("status, error_message")
        .eq("id", audit3Id)
        .single();
      if (swept >= 1 && after?.status === "failed") {
        pass("3", `running after restart → sweep freed #${audit3Id}`);
      } else {
        fail("3", `swept=${swept} after=${after?.status}`);
      }
    } else {
      fail("3", `completed before restart: ${still?.status}`);
    }
  } else {
    fail("3", `never running: ${running3?.status}`);
  }
}
await ensureOneMachine();

// ─── 4 Timeout 5s on heavy site ───────────────────────────────────────────
console.log("\n═══ 4 Timeout 5s ═══");
await clearSiteAudits();
const { data: siteMeta } = await admin
  .from("monitored_websites")
  .select("url")
  .eq("id", SITE_ID)
  .single();
try {
  fly(
    "secrets set WEB_AUDIT_TIMEOUT_MS=5000 WEB_AUDIT_CALLBACK_URL='https://qjglkywmqwqdoaboakao.supabase.co/functions/v1/website_audit_callback'",
  );
  fly("deploy --strategy immediate");
  await sleep(20000);
} catch (e) {
  console.warn("fly secrets/deploy:", e.message);
}
await admin
  .from("monitored_websites")
  .update({ url: "https://www.wikipedia.org" })
  .eq("id", SITE_ID);
const h4 = await enqueue(token);
const audit4Id = h4.body?.audit?.id;
const done4 = audit4Id
  ? await waitAudit(audit4Id, ["failed", "done"], 90_000)
  : null;
await admin
  .from("monitored_websites")
  .update({ url: HAPPY_AUDIT_URL })
  .eq("id", SITE_ID);
const { data: running4 } = await admin
  .from("website_audits")
  .select("id")
  .eq("id", audit4Id ?? 0)
  .eq("status", "running");
if (
  done4?.status === "failed" &&
  /límite|timeout|segundos/i.test(done4.error_message ?? "") &&
  !running4?.length
) {
  pass("4", `#${audit4Id} failed timeout: ${done4.error_message?.slice(0, 70)}`);
} else {
  fail(
    "4",
    `status=${done4?.status} running=${running4?.length ?? 0} msg=${done4?.error_message}`,
  );
}
try {
  fly(
    "secrets set WEB_AUDIT_TIMEOUT_MS=120000 WEB_AUDIT_CALLBACK_URL='https://qjglkywmqwqdoaboakao.supabase.co/functions/v1/website_audit_callback'",
  );
  fly("deploy --strategy immediate");
  await sleep(15000);
} catch (e) {
  console.warn("restore timeout:", e.message);
}

// ─── 5 HMAC (confirmed by test 0 if done) ─────────────────────────────────
console.log("\n═══ 5 HMAC ═══");
const test0 = results.find((r) => r.id === "0" || r.id === "0 (partial)");
if (test0?.ok && test0.detail.includes("done")) {
  pass("5", "happy path reached done → Fly/Supabase secrets match");
} else {
  fail("5", "happy path did not reach done — check WEB_AUDIT_WORKER_SECRET on Fly vs Supabase");
}

// ─── 6 Triple click ───────────────────────────────────────────────────────
console.log("\n═══ 6 Triple click ═══");
await clearSiteAudits();
await ensureOneMachine();
const [a, b, c] = await Promise.all([
  enqueue(token),
  enqueue(token),
  enqueue(token),
]);
const active6 = await countActive();
const ids = new Set([a, b, c].map((r) => r.body?.audit?.id).filter(Boolean));
const created = [a, b, c].filter((r) => r.body?.reused === false).length;
const reused = [a, b, c].filter((r) => r.body?.reused === true).length;
if (active6 === 1 && ids.size === 1 && created === 1 && reused === 2) {
  pass("6", `1 active, 1 created, 2 reused (id ${[...ids][0]})`);
} else {
  fail("6", `active=${active6} ids=${ids.size} created=${created} reused=${reused}`);
}
await admin.rpc("fail_stale_website_audits", { max_age_seconds: 0 });
await clearSiteAudits();

// ─── 7 Bot protection (Fly datacenter IP) ─────────────────────────────────
console.log("\n═══ 7 Bot protection ═══");
await restoreSiteUrl(siteUrlOriginal);
await clearSiteAudits();
const h7 = await enqueue(token); // site 150 = robsroofingct.com
const audit7Id = h7.body?.audit?.id;
const done7 = audit7Id
  ? await waitAudit(audit7Id, ["failed", "done"], 120_000)
  : null;
const health7 = await fetch(`${WORKER_URL}/health`);
const botMsg = done7?.error_message ?? "";
if (
  done7?.status === "failed" &&
  /bot|403|protección|blocked|cloudflare|forbidden|reset|WAF/i.test(botMsg) &&
  health7.ok
) {
  pass("7", `failed from Fly IP: ${botMsg.slice(0, 80)}; /health OK`);
} else if (done7?.status === "failed" && health7.ok) {
  pass("7 (soft)", `failed: ${botMsg.slice(0, 80)}; /health OK`);
} else {
  fail("7", `status=${done7?.status} msg=${botMsg} health=${health7.status}`);
}

} finally {
  await restoreSiteUrl(siteUrlOriginal);
}

console.log("\n════════ SUMMARY ════════");
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.id}: ${r.detail.slice(0, 140)}`);
}
const failed = results.filter((r) => !r.ok).length;
process.exit(failed > 0 ? 1 : 0);
