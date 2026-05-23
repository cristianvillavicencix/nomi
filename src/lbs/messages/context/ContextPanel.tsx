import { Link } from "react-router";
import { ExternalLink, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contact, Conversation, LbsDeal } from "@/lbs/types";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { StatusBadge } from "@/lbs/messages/status/StatusBadge";
import { useMaskedAmount } from "@/lib/permissions/useMaskedAmount";
import { cn } from "@/lib/utils";

export const ContextPanelContent = ({
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
      <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a conversation to see contact and project context.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Conversation
        </div>
        <div className="mt-1 text-base font-semibold">
          {conversation.title ?? "Untitled"}
        </div>
        <div className="mt-2">
          <StatusBadge status={conversation.status} />
        </div>
      </div>

      {contact ? (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Contact
          </div>
          <div className="mt-1 font-medium">
            {getContactDisplayName(contact)}
          </div>
          {contact.company_name ? (
            <div className="text-sm text-muted-foreground">
              {contact.company_name}
            </div>
          ) : null}
        </div>
      ) : null}

      {deal ? (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </div>
          <div className="mt-1 font-medium">{deal.name}</div>
          {deal.amount != null ? (
            <div className="text-sm text-muted-foreground">{maskedAmount}</div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Quick actions
        </div>
        {deal?.id != null ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Link to={`/deals/${deal.id}/show`}>
              <ExternalLink className="mr-2 size-4" />
              Open project
            </Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled
          title="Voice not configured"
        >
          <Phone className="mr-2 size-4" />
          Call (coming soon)
        </Button>
      </div>
    </div>
  );
};

export const ContextPanel = ({
  conversation,
  contact,
  deal,
  open,
  onClose,
}: {
  conversation: Conversation | null;
  contact?: Contact;
  deal?: LbsDeal;
  open: boolean;
  onClose?: () => void;
}) => (
  <aside
    className={cn(
      "hidden h-full min-h-0 shrink-0 overflow-hidden border-l border-border/40 bg-muted/10 transition-[width] duration-200 ease-out lg:flex",
      open ? "w-[300px] xl:w-[320px]" : "w-0 border-l-transparent",
    )}
    aria-hidden={!open}
  >
    <div
      className={cn(
        "flex h-full w-[300px] flex-col overflow-y-auto xl:w-[320px]",
        !open && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
        <span className="text-sm font-medium">Details</span>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            aria-label="Close details panel"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <ContextPanelContent
        conversation={conversation}
        contact={contact}
        deal={deal}
      />
    </div>
  </aside>
);
