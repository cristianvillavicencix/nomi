import { getExpectedAuthorization } from "../postmark/getExpectedAuthorization.ts";

const readCredentials = () => {
  const user =
    Deno.env.get("EMAIL_INBOUND_WEBHOOK_USER")?.trim() ??
    Deno.env.get("SENDGRID_INBOUND_WEBHOOK_USER")?.trim() ??
    Deno.env.get("POSTMARK_WEBHOOK_USER")?.trim();
  const password =
    Deno.env.get("EMAIL_INBOUND_WEBHOOK_PASSWORD")?.trim() ??
    Deno.env.get("SENDGRID_INBOUND_WEBHOOK_PASSWORD")?.trim() ??
    Deno.env.get("POSTMARK_WEBHOOK_PASSWORD")?.trim();
  return { user, password };
};

export const checkInboundEmailWebhookAuth = (req: Request) => {
  const { user, password } = readCredentials();
  if (!user || !password) {
    return new Response(
      "Missing EMAIL_INBOUND_WEBHOOK_USER or EMAIL_INBOUND_WEBHOOK_PASSWORD",
      { status: 500 },
    );
  }

  const expected = getExpectedAuthorization(user, password);
  const authorization = req.headers.get("Authorization");
  if (authorization !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
};
