import type { Identifier } from "ra-core";
import { mailtoHref } from "@/lib/linking";
import type { MailComposeOpenArgs } from "./mailComposeContext";

export type OpenCrmEmailArgs = {
  to: string;
  contactId?: Identifier;
  companyId?: Identifier;
  subject?: string;
  body?: string;
};

export function openCrmEmailWithFallback(
  args: OpenCrmEmailArgs,
  canCompose: boolean,
  openCompose?: (composeArgs?: MailComposeOpenArgs) => void,
) {
  const email = args.to.trim();
  if (!email) return;

  if (canCompose && openCompose) {
    openCompose({
      mode: "new",
      initialTo: email,
      initialSubject: args.subject,
      initialBody: args.body,
      contactId: args.contactId,
      companyId: args.companyId,
    });
    return;
  }

  const href = mailtoHref(email);
  if (!href) return;

  const params = new URLSearchParams();
  if (args.subject?.trim()) params.set("subject", args.subject.trim());
  if (args.body?.trim()) params.set("body", args.body.trim());
  const query = params.toString();
  window.location.href = query ? `${href}?${query}` : href;
}
