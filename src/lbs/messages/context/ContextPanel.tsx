import { Link } from "react-router";
import { ExternalLink, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contact, Conversation, LbsDeal } from "@/lbs/types";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { StatusBadge } from "@/lbs/messages/status/StatusBadge";
import { useMaskedAmount } from "@/lib/permissions/useMaskedAmount";

export const ContextPanel = ({
  conversation,
  contact,
  deal,
}: {
  conversation: Conversation | null;
  contact?: Contact;
  deal?: LbsDeal;
}) => {
  const maskedAmount = useMaskedAmount(deal?.amount ?? null);

  if (!conversation) {
    return (
      <aside className="hidden w-[280px] shrink-0 border-l border-border/40 bg-muted/10 xl:flex xl:flex-col">
        <div className="p-4 text-sm text-muted-foreground">
          Select a conversation to see contact and project context.
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[280px] shrink-0 border-l border-border/40 bg-muted/10 xl:flex xl:flex-col">
      <div className="space-y-4 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conversation
          </div>
          <div className="mt-1 font-semibold">{conversation.title ?? "Untitled"}</div>
          <div className="mt-2">
            <StatusBadge status={conversation.status} />
          </div>
        </div>

        {contact ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact
            </div>
            <div className="mt-1 font-medium">{getContactDisplayName(contact)}</div>
            {contact.company_name ? (
              <div className="text-sm text-muted-foreground">{contact.company_name}</div>
            ) : null}
          </div>
        ) : null}

        {deal ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Project
            </div>
            <div className="mt-1 font-medium">{deal.name}</div>
            {deal.amount != null ? (
              <div className="text-sm text-muted-foreground">{maskedAmount}</div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick actions
          </div>
          {deal?.id != null ? (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to={`/deals/${deal.id}/show`}>
                <ExternalLink className="mr-2 size-4" />
                Open project
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="w-full justify-start" disabled title="Voice not configured">
            <Phone className="mr-2 size-4" />
            Call (coming soon)
          </Button>
        </div>
      </div>
    </aside>
  );
};
