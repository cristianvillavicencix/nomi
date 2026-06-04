const getPostmarkServerToken = () =>
  Deno.env.get("POSTMARK_SERVER_TOKEN")?.trim();

const getPostmarkFromEmail = () => Deno.env.get("POSTMARK_FROM_EMAIL")?.trim();

export type PostmarkAttachment = {
  name: string;
  contentBase64: string;
  contentType: string;
};

export async function sendPostmarkEmail(params: {
  to: string;
  subject: string;
  textBody: string;
  attachments?: PostmarkAttachment[];
}) {
  const token = getPostmarkServerToken();
  const from = getPostmarkFromEmail();
  if (!token || !from) {
    throw new Error(
      "Email is not configured (POSTMARK_SERVER_TOKEN / POSTMARK_FROM_EMAIL).",
    );
  }

  const htmlBody = params.textBody
    .split("\n")
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.textBody,
      HtmlBody: htmlBody,
      Attachments: (params.attachments ?? []).map((file) => ({
        Name: file.name,
        Content: file.contentBase64,
        ContentType: file.contentType,
        ContentID: null,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not send email (${res.status}) ${text}`);
  }
}
