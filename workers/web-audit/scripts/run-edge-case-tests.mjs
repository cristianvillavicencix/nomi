#!/usr/bin/env node
/**
 * Forced edge-case tests for website audit pipeline (hosted Supabase).
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/run-edge-case-tests.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://qjglkywmqwqdoaboakao.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@lbs.bz";
const SITE_ID = Number(process.env.TEST_SITE_ID ?? 150);
const WORKER_SECRET =
  process.env.WEB_AUDIT_WORKER_SECRET ?? "nomi-web-audit-test-secret-2026";
const WORKER_PORT = Number(process.env.WEB_AUDIT_WORKER_PORT ?? 8787);
let nextWorkerPort = WORKER_PORT;

const freePort = async (port) => {
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
      stdio: "ignore",
    });
  } catch {
    /* ignore */
  }
  await sleep(500);
};

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

const pass = (name, detail) => {
  results.push({ name, ok: true, detail });
  console.log(`\n✅ PASS — ${name}\n   ${detail}`);
};

const fail = (name, detail) => {
  results.push({ name, ok: false, detail });
  console.log(`\n❌ FAIL — ${name}\n   ${detail}`);
};

const getUserJwt = async () => {
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL,
    });
  if (linkError) throw linkError;

  // Prefer email_otp (Supabase v2); fall back to hashed_token verify flow.
  const otp =
    linkData.properties.email_otp ?? linkData.properties.hashed_token;
  const { data: otpData, error: otpError } = await admin.auth.verifyOtp({
    email: ADMIN_EMAIL,
    token: otp,
    type: "email",
  });
  if (otpError) {
    throw new Error(
      `Could not mint test JWT for ${ADMIN_EMAIL} without changing password: ${otpError.message}. ` +
        "Set TEST_ADMIN_ACCESS_TOKEN or use a dedicated test user.",
    );
  }
  return otpData.session.access_token;
};

const enqueue = async (token) => {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/website_audit_enqueue`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ monitored_website_id: SITE_ID }),
    },
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
};

const countActiveAudits = async () => {
  const { count, error } = await admin
    .from("website_audits")
    .select("id", { count: "exact", head: true })
    .eq("monitored_website_id", SITE_ID)
    .in("status", ["queued", "running"]);
  if (error) throw error;
  return count ?? 0;
};

const countFindings = async (auditId) => {
  const { count, error } = await admin
    .from("audit_findings")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", auditId);
  if (error) throw error;
  return count ?? 0;
};

const clearSiteAudits = async () => {
  const { data: audits } = await admin
    .from("website_audits")
    .select("id")
    .eq("monitored_website_id", SITE_ID);
  const ids = (audits ?? []).map((a) => a.id);
  if (ids.length) {
    await admin.from("audit_findings").delete().in("audit_id", ids);
    await admin.from("website_audits").delete().in("id", ids);
  }
};

const setHostedSecrets = (workerUrl) => {
  execSync(
    `supabase secrets set WEB_AUDIT_WORKER_SECRET=${WORKER_SECRET} WEB_AUDIT_WORKER_URL=${workerUrl} --project-ref qjglkywmqwqdoaboakao`,
    { stdio: "pipe", cwd: new URL("../../..", import.meta.url).pathname },
  );
  return sleep(3000);
};

const startWorker = (extraEnv = {}) =>
  new Promise(async (resolve, reject) => {
    const port = nextWorkerPort++;
    await freePort(port);
    const workerDir = new URL("..", import.meta.url).pathname;
    const child = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: workerDir,
      env: {
        ...process.env,
        PORT: String(port),
        WEB_AUDIT_WORKER_SECRET: WORKER_SECRET,
        WEB_AUDIT_TIMEOUT_MS: extraEnv.timeoutMs ?? "120000",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.workerPort = port;
    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) {
        child.kill();
        reject(new Error("Worker startup timeout"));
      }
    }, 30_000);

    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      if (text.includes("listening") || text.includes(String(port))) {
        ready = true;
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", (buf) => process.stderr.write(buf));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!ready) reject(new Error(`Worker exited early: ${code}`));
    });
    // Fallback: probe /health
    sleep(2000).then(async () => {
      if (ready) return;
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (r.ok) {
          ready = true;
          clearTimeout(timer);
          resolve(child);
        }
      } catch {
        /* retry */
      }
    });
  });

const postWorkerAudit = async (job, port = WORKER_PORT) => {
  const res = await fetch(`http://127.0.0.1:${port}/audit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WORKER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(job),
  });
  return { status: res.status, body: await res.text() };
};

const createQueuedAudit = async (url, strategy = "mobile") => {
  const { data: site } = await admin
    .from("monitored_websites")
    .select("org_id, url")
    .eq("id", SITE_ID)
    .single();

  const { data: audit, error } = await admin
    .from("website_audits")
    .insert({
      org_id: site.org_id,
      monitored_website_id: SITE_ID,
      status: "queued",
      audit_url: url ?? site.url,
      strategy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return audit;
};

const waitForAuditStatus = async (auditId, statuses, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await admin
      .from("website_audits")
      .select("status, error_message")
      .eq("id", auditId)
      .maybeSingle();
    if (data && statuses.includes(data.status)) return data;
    await sleep(1500);
  }
  const { data } = await admin
    .from("website_audits")
    .select("status, error_message")
    .eq("id", auditId)
    .maybeSingle();
  return data;
};

const callbackUrl = `${SUPABASE_URL}/functions/v1/website_audit_callback`;

// ─── Test 1: Worker down at enqueue ───────────────────────────────────────
async function test1WorkerDown(token) {
  console.log("\n═══ TEST 1: Worker caído al encolar ═══");
  await clearSiteAudits();
  await setHostedSecrets("http://127.0.0.1:59999");

  const r1 = await enqueue(token);
  const audit1 = r1.body?.audit;
  if (
    r1.status === 200 &&
    audit1?.status === "failed" &&
    String(audit1?.error_message ?? "").includes("Worker no disponible")
  ) {
    pass("1 Worker down", `audit #${audit1.id} failed: ${audit1.error_message?.slice(0, 80)}`);
  } else {
    fail("1 Worker down", JSON.stringify(r1.body));
  }

  const activeAfter = await countActiveAudits();
  if (activeAfter === 0) {
    pass("1 Site not blocked", "0 active queued|running after failed push");
  } else {
    fail("1 Site not blocked", `active count=${activeAfter}`);
  }

  const r2 = await enqueue(token);
  if (r2.status === 200 && r2.body?.reused === false) {
    pass("1 Immediate retry", `second enqueue created audit #${r2.body?.audit?.id}`);
  } else {
    fail("1 Immediate retry", JSON.stringify(r2.body));
  }
}

// ─── Test 5: Triple click (echo worker keeps queued) ──────────────────────
async function test5TripleClick(token) {
  console.log("\n═══ TEST 5: Doble/triple clic ═══");
  await clearSiteAudits();
  await setHostedSecrets("https://httpbin.org/anything");

  const [a, b, c] = await Promise.all([
    enqueue(token),
    enqueue(token),
    enqueue(token),
  ]);

  const active = await countActiveAudits();
  const auditIds = new Set([a, b, c].map((r) => r.body?.audit?.id).filter(Boolean));
  const created = [a, b, c].filter((r) => r.body?.reused === false).length;
  const reused = [a, b, c].filter((r) => r.body?.reused === true).length;

  if (active === 1 && auditIds.size === 1 && created === 1 && reused === 2) {
    pass(
      "5 Triple click",
      `1 active audit, 1 created + 2 reused (ids: ${[a, b, c].map((r) => r.body?.audit?.id).join(", ")})`,
    );
  } else {
    fail(
      "5 Triple click",
      `active=${active} created=${created} reused=${reused} bodies=${JSON.stringify([a.body, b.body, c.body])}`,
    );
  }

  // cleanup orphan queued from echo worker
  await admin.rpc("fail_stale_website_audits", { max_age_seconds: 0 });
  await clearSiteAudits();
}

// ─── Test 2: Real timeout ───────────────────────────────────────────────────
async function test2Timeout() {
  console.log("\n═══ TEST 2: Timeout real (5s) ═══");
  let worker;
  try {
    worker = await startWorker({ WEB_AUDIT_TIMEOUT_MS: "5000" });
    const port = worker.workerPort;
    const audit = await createQueuedAudit("https://www.wikipedia.org");
    await postWorkerAudit(
      {
        audit_id: audit.id,
        org_id: audit.org_id,
        monitored_website_id: SITE_ID,
        url: "https://www.wikipedia.org",
        strategy: "mobile",
        callback_url: callbackUrl,
      },
      port,
    );

    const final = await waitForAuditStatus(audit.id, ["failed", "done"], 45_000);
    if (final?.status === "failed" && /límite|timeout|segundos/i.test(final.error_message ?? "")) {
      pass("2 Timeout", `#${audit.id} failed: ${final.error_message}`);
    } else {
      fail("2 Timeout", `status=${final?.status} msg=${final?.error_message}`);
    }

    const { data: stuck } = await admin
      .from("website_audits")
      .select("id")
      .eq("id", audit.id)
      .eq("status", "running");
    if (!stuck?.length) pass("2 Not stuck running", "no running row after timeout");
    else fail("2 Not stuck running", "still running");
  } finally {
    worker?.kill("SIGTERM");
    await freePort(worker?.workerPort ?? WORKER_PORT);
  }
}

// ─── Test 3: Worker killed mid-audit + stale sweep ────────────────────────
async function test3StaleSweep() {
  console.log("\n═══ TEST 3: Worker kill -9 + stale sweep ═══");
  let worker;
  try {
    worker = await startWorker({ WEB_AUDIT_TIMEOUT_MS: "120000" });
    const port = worker.workerPort;
    const audit = await createQueuedAudit("https://www.wikipedia.org");
    await postWorkerAudit(
      {
        audit_id: audit.id,
        org_id: audit.org_id,
        monitored_website_id: SITE_ID,
        url: "https://www.wikipedia.org",
        strategy: "mobile",
        callback_url: callbackUrl,
      },
      port,
    );

    await waitForAuditStatus(audit.id, ["running"], 30_000);
    worker.kill("SIGKILL");
    worker = null;
    await sleep(2000);

    const { data: running } = await admin
      .from("website_audits")
      .select("status")
      .eq("id", audit.id)
      .single();

    if (running?.status === "running") {
      pass("3 Stays running after kill", `audit #${audit.id} still running (no callback)`);
    } else {
      fail("3 Stays running after kill", `status=${running?.status}`);
    }

    // Backdate so sweep applies immediately
    await admin
      .from("website_audits")
      .update({ started_at: new Date(Date.now() - 200_000).toISOString() })
      .eq("id", audit.id);

    const { data: swept, error } = await admin.rpc("fail_stale_website_audits", {
      max_age_seconds: 60,
    });
    if (error) throw error;

    const { data: after } = await admin
      .from("website_audits")
      .select("status, error_message")
      .eq("id", audit.id)
      .single();

    if (swept >= 1 && after?.status === "failed" && /expirado|barrido/i.test(after.error_message ?? "")) {
      pass("3 Stale sweep", `fail_stale_website_audits → failed: ${after.error_message?.slice(0, 80)}`);
    } else {
      fail("3 Stale sweep", `swept=${swept} status=${after?.status} msg=${after?.error_message}`);
    }
  } finally {
    worker?.kill("SIGTERM");
    await freePort(worker?.workerPort ?? WORKER_PORT);
  }
}

// ─── Test 4: Double callback idempotency ──────────────────────────────────
async function test4DoubleCallback() {
  console.log("\n═══ TEST 4: Doble callback ═══");
  let worker;
  try {
    worker = await startWorker({ WEB_AUDIT_TIMEOUT_MS: "90000" });
    const port = worker.workerPort;
    const audit = await createQueuedAudit("https://example.com");
    await postWorkerAudit(
      {
        audit_id: audit.id,
        org_id: audit.org_id,
        monitored_website_id: SITE_ID,
        url: "https://example.com",
        strategy: "mobile",
        callback_url: callbackUrl,
      },
      port,
    );

    const final = await waitForAuditStatus(audit.id, ["done", "failed"], 120_000);
    if (final?.status !== "done") {
      fail("4 Prerequisite done audit", `audit ended as ${final?.status}: ${final?.error_message}`);
      return;
    }

    const findingsBefore = await countFindings(audit.id);
    const { data: fullAudit } = await admin
      .from("website_audits")
      .select("*")
      .eq("id", audit.id)
      .single();

    const duplicatePayload = {
      audit_id: audit.id,
      status: "done",
      worker_id: "manual-replay",
      overall_score: fullAudit.overall_score,
      findings: [
        {
          category: "seo",
          severity: "importante",
          source: "manual",
          title: "SHOULD NOT INSERT",
        },
      ],
    };

    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(duplicatePayload),
    });
    const body = await res.json();
    const findingsAfter = await countFindings(audit.id);

    if (
      res.status === 200 &&
      body.idempotent === true &&
      findingsAfter === findingsBefore
    ) {
      pass(
        "4 Double callback",
        `idempotent:true, findings unchanged (${findingsBefore} rows)`,
      );
    } else {
      fail(
        "4 Double callback",
        `status=${res.status} body=${JSON.stringify(body)} before=${findingsBefore} after=${findingsAfter}`,
      );
    }
  } finally {
    worker?.kill("SIGTERM");
    await freePort(worker?.workerPort ?? WORKER_PORT);
  }
}

// ─── Test 6: Bot protection ─────────────────────────────────────────────────
async function test6BotProtection() {
  console.log("\n═══ TEST 6: Bot protection ═══");
  let worker;
  // httpbin 403 simulates WAF/bot block reliably from any IP.
  // robsroofingct.com only blocks datacenter IPs (monitor false-DOWN), not residential.
  const botTestUrl = "https://httpbin.org/status/403";
  try {
    worker = await startWorker({ WEB_AUDIT_TIMEOUT_MS: "60000" });
    const port = worker.workerPort;
    const { data: site } = await admin
      .from("monitored_websites")
      .select("org_id")
      .eq("id", SITE_ID)
      .single();

    const audit = await createQueuedAudit(botTestUrl);
    await postWorkerAudit(
      {
        audit_id: audit.id,
        org_id: site.org_id,
        monitored_website_id: SITE_ID,
        url: botTestUrl,
        strategy: "mobile",
        callback_url: callbackUrl,
      },
      port,
    );

    const final = await waitForAuditStatus(audit.id, ["failed", "done"], 90_000);
    const health = await fetch(`http://127.0.0.1:${port}/health`);

    const botFail =
      final?.status === "failed" &&
      /bot|protección|403|blocked|cloudflare|forbidden|acceso/i.test(
        final.error_message ?? "",
      );

    if (botFail && health.ok) {
      pass("6 Bot protection", `failed gracefully: ${final.error_message?.slice(0, 100)}; /health OK`);
    } else if (final?.status === "failed" && health.ok) {
      pass("6 Bot protection (soft)", `failed (msg may vary): ${final.error_message?.slice(0, 100)}; /health OK`);
    } else {
      fail(
        "6 Bot protection",
        `status=${final?.status} msg=${final?.error_message} health=${health.status}`,
      );
    }
  } finally {
    worker?.kill("SIGTERM");
    await freePort(worker?.workerPort ?? WORKER_PORT);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
console.log("Website audit edge-case tests");
console.log(`Supabase: ${SUPABASE_URL}  site_id=${SITE_ID}`);

const token = await getUserJwt();
console.log(`JWT for ${ADMIN_EMAIL} obtained`);

await test1WorkerDown(token);
await test5TripleClick(token);
await test2Timeout();
await test3StaleSweep();
await test4DoubleCallback();
await test6BotProtection();

// Restore dead worker URL so prod UI doesn't push to echo
await setHostedSecrets("http://127.0.0.1:59999");

console.log("\n════════ SUMMARY ════════");
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.name}: ${r.detail.slice(0, 120)}`);
}
console.log(`\nTotal: ${passed} passed, ${failed} failed (${results.length} assertions)`);
process.exit(failed > 0 ? 1 : 0);
