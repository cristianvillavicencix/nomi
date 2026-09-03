import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import { resolveInvoiceOrganizationName } from "./invoiceOrganizationInfo.ts";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const publicOrgLabel = (orgName?: string | null) =>
  resolveInvoiceOrganizationName({ title: orgName });

const defaultLogoUrl = (logoUrl?: string | null) =>
  logoUrl?.trim() || `${resolvePublicAppBaseUrl()}/logos/sigma.png`;

const planLabel = (params: {
  subscriptionName: string;
  amountLabel?: string | null;
}) =>
  params.amountLabel
    ? `${params.subscriptionName} (${params.amountLabel})`
    : params.subscriptionName;

export const flattenSmsBody = (body: string) =>
  body.replace(/\s+/g, " ").trim();

export type AgreementInviteCopyParams = {
  orgName: string | null;
  clientName?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
  /** Absolute logo URL for HTML email. Defaults to product mark on public app. */
  logoUrl?: string | null;
};

/** Compact SMS — one paragraph so phones do not split text + link preview. */
export const buildDefaultAgreementInviteSms = (
  params: AgreementInviteCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const plan = planLabel(params);
  const ref = params.subscriptionNumber?.trim()
    ? ` Ref ${params.subscriptionNumber.trim()}.`
    : "";
  return flattenSmsBody(
    `${orgLabel}: Please review, sign, and add your card for ${plan}.${ref} ${params.shareUrl.trim()}`,
  );
};

export const buildDefaultAgreementInviteSubject = (
  params: Pick<AgreementInviteCopyParams, "subscriptionName">,
) => `Please review and sign: ${params.subscriptionName}`;

export const buildDefaultAgreementInviteText = (
  params: AgreementInviteCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const greeting = params.clientName?.trim()
    ? `Hello ${params.clientName.trim()},`
    : "Hello,";
  const plan = planLabel(params);
  const lines = [
    greeting,
    "",
    `${orgLabel} invited you to review and sign the subscription agreement for ${plan}.`,
  ];
  if (params.subscriptionNumber?.trim()) {
    lines.push(`Reference: ${params.subscriptionNumber.trim()}`);
  }
  lines.push(
    "",
    `Review the terms, sign, and add your payment card here: ${params.shareUrl.trim()}`,
    "",
    "Billing starts automatically after you complete those steps.",
    "",
    `— ${orgLabel}`,
  );
  return lines.join("\n");
};

export const buildDefaultAgreementInviteHtml = (
  params: AgreementInviteCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const plan = planLabel(params);
  const logo = defaultLogoUrl(params.logoUrl);
  const shareUrl = params.shareUrl.trim();

  return `
<div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.55;max-width:560px;margin:0 auto;">
  <div style="padding:8px 0 20px;">
    <img src="${escapeHtml(logo)}" alt="${escapeHtml(orgLabel)}" width="120" height="auto" style="display:block;max-height:48px;width:auto;" />
  </div>
  <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
  <p style="margin:0 0 12px;font-size:15px;">
    <strong>${escapeHtml(orgLabel)}</strong> invited you to review and sign the subscription agreement for
    <strong>${escapeHtml(plan)}</strong>.
  </p>
  ${
    params.subscriptionNumber?.trim()
      ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Reference: ${escapeHtml(params.subscriptionNumber.trim())}</p>`
      : ""
  }
  <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">
    Review the terms, add your signature, then save a payment card. Billing starts automatically after you finish.
  </p>
  <p style="margin:0 0 28px;">
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">
      Review &amp; sign agreement
    </a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;font-family:system-ui,sans-serif;word-break:break-all;">
    Or open this link: <a href="${escapeHtml(shareUrl)}" style="color:#4b5563;">${escapeHtml(shareUrl)}</a>
  </p>
  <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— ${escapeHtml(orgLabel)}</p>
</div>`.trim();
};

export const buildDefaultAgreementCompletionSubject = (params: {
  orgName: string;
  subscriptionName: string;
  subscriptionNumber?: string | null;
}) =>
  `${params.orgName}: Your signed agreement and receipt · ${
    params.subscriptionNumber?.trim() || params.subscriptionName
  }`;

export const buildDefaultAgreementCompletionText = (params: {
  orgName: string;
  subscriptionName: string;
  contractFilename: string;
  receiptFilename: string;
}) =>
  [
    `Thank you for signing and adding your payment method for ${params.subscriptionName}.`,
    "",
    "Attached:",
    `- ${params.contractFilename} (signed agreement)`,
    `- ${params.receiptFilename} (setup receipt)`,
    "",
    "Billing will continue automatically according to your plan.",
    "",
    `— ${params.orgName}`,
  ].join("\n");

export const buildDefaultAgreementCompletionHtml = (params: {
  orgName: string;
  subscriptionName: string;
  contractFilename: string;
  receiptFilename: string;
  logoUrl?: string | null;
}) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const logo = defaultLogoUrl(params.logoUrl);
  return `
<div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.55;max-width:560px;margin:0 auto;">
  <div style="padding:8px 0 20px;">
    <img src="${escapeHtml(logo)}" alt="${escapeHtml(orgLabel)}" width="120" height="auto" style="display:block;max-height:48px;width:auto;" />
  </div>
  <p style="margin:0 0 16px;font-size:16px;">Thank you</p>
  <p style="margin:0 0 12px;font-size:15px;">
    Your signature and payment card for <strong>${escapeHtml(params.subscriptionName)}</strong> are on file.
  </p>
  <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">Attached to this email:</p>
  <ul style="margin:0 0 20px;padding-left:18px;font-size:14px;color:#4b5563;">
    <li>${escapeHtml(params.contractFilename)} — signed agreement</li>
    <li>${escapeHtml(params.receiptFilename)} — setup receipt</li>
  </ul>
  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
    Billing continues automatically according to your plan.
  </p>
  <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— ${escapeHtml(orgLabel)}</p>
</div>`.trim();
};

export type SubscriptionSetupCopyKind = "setup" | "card_update";

export type SubscriptionSetupCopyParams = AgreementInviteCopyParams & {
  kind?: SubscriptionSetupCopyKind;
};

const brandedEmailShell = (params: {
  orgLabel: string;
  logoUrl?: string | null;
  greeting: string;
  bodyHtml: string;
  shareUrl: string;
  ctaLabel: string;
}) => {
  const logo = defaultLogoUrl(params.logoUrl);
  const shareUrl = params.shareUrl.trim();
  return `
<div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.55;max-width:560px;margin:0 auto;">
  <div style="padding:8px 0 20px;">
    <img src="${escapeHtml(logo)}" alt="${escapeHtml(params.orgLabel)}" width="120" height="auto" style="display:block;max-height:48px;width:auto;" />
  </div>
  <p style="margin:0 0 16px;font-size:16px;">${params.greeting}</p>
  ${params.bodyHtml}
  <p style="margin:0 0 28px;">
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">
      ${escapeHtml(params.ctaLabel)}
    </a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;font-family:system-ui,sans-serif;word-break:break-all;">
    Or open this link: <a href="${escapeHtml(shareUrl)}" style="color:#4b5563;">${escapeHtml(shareUrl)}</a>
  </p>
  <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— ${escapeHtml(params.orgLabel)}</p>
</div>`.trim();
};

export const buildDefaultSubscriptionSetupSms = (
  params: SubscriptionSetupCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const plan = planLabel(params);
  const url = params.shareUrl.trim();
  if (params.kind === "card_update") {
    return flattenSmsBody(
      `${orgLabel}: update your card for ${plan}: ${url}`,
    );
  }
  return flattenSmsBody(
    `${orgLabel}: ready to start ${plan}? Add your card for automatic billing: ${url}`,
  );
};

export const buildDefaultSubscriptionSetupSubject = (
  params: SubscriptionSetupCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  if (params.kind === "card_update") {
    return `Update your card for ${params.subscriptionName}`;
  }
  return `Start ${params.subscriptionName} with ${orgLabel}`;
};

export const buildDefaultSubscriptionSetupText = (
  params: SubscriptionSetupCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const greeting = params.clientName?.trim()
    ? `Hello ${params.clientName.trim()},`
    : "Hello,";
  const plan = planLabel(params);
  const url = params.shareUrl.trim();
  const intro =
    params.kind === "card_update"
      ? `${orgLabel} needs an updated card for ${plan}.`
      : `${orgLabel} is ready for you to start ${plan}.`;
  const next =
    params.kind === "card_update"
      ? `Update your payment card here: ${url}`
      : `Add your card once for automatic billing: ${url}`;
  const lines = [greeting, "", intro];
  if (params.subscriptionNumber?.trim()) {
    lines.push(`Reference: ${params.subscriptionNumber.trim()}`);
  }
  lines.push("", next, "", `— ${orgLabel}`);
  return lines.join("\n");
};

export const buildDefaultSubscriptionSetupHtml = (
  params: SubscriptionSetupCopyParams,
) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const plan = planLabel(params);
  const intro =
    params.kind === "card_update"
      ? `<p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(orgLabel)}</strong> needs an updated card for <strong>${escapeHtml(plan)}</strong>.</p>`
      : `<p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(orgLabel)}</strong> is ready for you to start <strong>${escapeHtml(plan)}</strong>.</p>`;
  const next =
    params.kind === "card_update"
      ? `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Update your payment method so billing continues without interruption.</p>`
      : `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Add your card once — billing runs automatically from there.</p>`;
  const ref = params.subscriptionNumber?.trim()
    ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Reference: ${escapeHtml(params.subscriptionNumber.trim())}</p>`
    : "";
  return brandedEmailShell({
    orgLabel,
    logoUrl: params.logoUrl,
    greeting,
    bodyHtml: `${intro}${ref}${next}`,
    shareUrl: params.shareUrl,
    ctaLabel:
      params.kind === "card_update" ? "Update card" : "Start subscription",
  });
};

export const wrapSubscriptionMessageInBrandedHtml = (params: {
  orgName?: string | null;
  message: string;
  shareUrl: string;
  ctaLabel: string;
  logoUrl?: string | null;
  clientName?: string | null;
}) => {
  const orgLabel = publicOrgLabel(params.orgName);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const body = escapeHtml(params.message.trim()).replace(/\n/g, "<br/>");
  return brandedEmailShell({
    orgLabel,
    logoUrl: params.logoUrl,
    greeting,
    bodyHtml: `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">${body}</p>`,
    shareUrl: params.shareUrl,
    ctaLabel: params.ctaLabel,
  });
};

