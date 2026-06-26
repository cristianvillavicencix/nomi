/**
 * Vercel cron → Supabase process_scheduled_client_invoices.
 * Env: CRON_SECRET, VITE_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export default async function handler(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization")?.trim();

  if (cronSecret) {
    const expected = `Bearer ${cronSecret}`;
    if (authHeader !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/process_scheduled_client_invoices`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
      },
      body: "{}",
    },
  );

  const body = await response.text();
  let payload: unknown = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = { raw: body };
  }

  return Response.json(payload, { status: response.status });
}
