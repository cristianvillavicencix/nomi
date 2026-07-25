import { Link } from "react-router";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { mailboxesSettingsPath } from "./mailSettingsPath";

export function MailEmptyState({
  title = "No mailboxes connected",
  description = "Connect Gmail, Outlook, or another account in Settings. Messages will show up here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
      <EnvelopeSimple className="size-10 text-muted-foreground" weight="duotone" />
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link to={mailboxesSettingsPath()}>Connect a mailbox</Link>
      </Button>
    </div>
  );
}
