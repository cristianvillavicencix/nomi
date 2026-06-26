export interface SignatureContext {
  user_first_name: string;
  user_last_name: string;
  user_full_name: string;
  org_name: string;
}

export const DEFAULT_SMS_SIGNATURE_TEMPLATE =
  "- {{user_first_name}} {{user_last_name}} | {{org_name}}";

export function expandSignature(
  template: string,
  context: SignatureContext,
): string {
  if (!template.trim()) return "";

  return template
    .replace(/\{\{user_first_name\}\}/g, context.user_first_name)
    .replace(/\{\{user_last_name\}\}/g, context.user_last_name)
    .replace(/\{\{user_full_name\}\}/g, context.user_full_name)
    .replace(/\{\{org_name\}\}/g, context.org_name);
}

export function parseMessageBodyWithSignature(body: string) {
  const lines = body.split("\n");
  const lastLine = lines[lines.length - 1]?.trim() ?? "";

  if (lastLine.startsWith("-") || lastLine.startsWith("—")) {
    return {
      content: lines.slice(0, -1).join("\n").trim(),
      signature: lastLine,
    };
  }

  return { content: body, signature: null as string | null };
}

export function resolveOrganizationSmsSignature(params: {
  template: string | null | undefined;
  orgEnabled: boolean | null | undefined;
  forceUserSignature: boolean;
  context: SignatureContext;
}): { signature: string; signatureRequired: boolean } {
  const template =
    params.template?.trim() || DEFAULT_SMS_SIGNATURE_TEMPLATE;
  const orgEnabled = params.orgEnabled ?? true;
  const shouldApply = orgEnabled || params.forceUserSignature;
  const signature = shouldApply
    ? expandSignature(template, params.context)
    : "";

  return {
    signature,
    signatureRequired: params.forceUserSignature && signature.length > 0,
  };
}
