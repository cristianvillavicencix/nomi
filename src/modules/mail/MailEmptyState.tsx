import { Link } from "react-router";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/modules/shared/chrome";
import { mailboxesSettingsPath } from "./mailSettingsPath";

export function MailEmptyState({
  title = "No mailboxes connected",
  description = "Connect Gmail, Outlook, or another account in Settings. Messages will show up here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      className="h-full min-h-[320px]"
      icon={<EnvelopeSimple className="size-8 text-muted-foreground" weight="duotone" />}
      title={title}
      description={description}
      action={
        <Button asChild>
          <Link to={mailboxesSettingsPath()}>Connect a mailbox</Link>
        </Button>
      }
    />
  );
}
