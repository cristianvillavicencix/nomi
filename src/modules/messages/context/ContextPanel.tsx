import { Link } from "react-router";
import type { ReactNode } from "react";
import { ExternalLink, Mail, Phone, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contact, Conversation, LbsDeal } from "@/modules/types";
import {
  getContactDisplayName,
  getContactPhoneEntries,
} from "@/modules/messages/messageContactUtils";
import { StatusBadge } from "@/modules/messages/status/StatusBadge";
import { useMaskedAmount } from "@/lib/permissions/useMaskedAmount";
import { getPersonShowPath } from "@/app/routing";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";
import { VoiceCallButton } from "@/modules/voice/VoiceCallButton";

const DetailSection = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div>
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="mt-1.5 space-y-1">{children}</div>
  </div>
);

export const ContextPanelContent = ({
  conversation,
  contact,
  deal,
  activeSmsPhone,
}: {
  conversation: Conversation | null;
  contact?: Contact;
  deal?: LbsDeal;
  activeSmsPhone?: string | null;
}) => {
  const maskedAmount = useMaskedAmount(deal?.amount ?? null);

  if (!conversation && !contact) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a conversation to see contact and project context.
      </div>
    );
  }

  const phoneEntries = contact ? getContactPhoneEntries(contact) : [];
  const callPhone =
    activeSmsPhone ??
    conversation?.external_phone ??
    phoneEntries[0]?.e164 ??
    null;
  const emailEntries =
    contact?.email_jsonb?.filter((entry) => entry.email?.trim()) ?? [];

  return (
    <div className="space-y-5 p-5">
      {conversation ? (
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
          {conversation.type === "client" &&
          (activeSmsPhone ?? conversation.external_phone) ? (
            <p className="mt-2 text-sm text-muted-foreground">
              SMS to{" "}
              <span className="font-medium text-foreground">
                {formatUsPhoneDisplayFromAny(
                  activeSmsPhone ?? conversation.external_phone ?? "",
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {contact ? (
        <div className="space-y-4">
          <DetailSection label="Contact">
            <p className="font-medium">{getContactDisplayName(contact)}</p>
            {contact.title?.trim() ? (
              <p className="text-sm text-muted-foreground">{contact.title}</p>
            ) : null}
            {contact.company_name ? (
              <p className="text-sm text-muted-foreground">
                {contact.company_name}
              </p>
            ) : null}
          </DetailSection>

          {phoneEntries.length > 0 ? (
            <DetailSection label="Phone numbers">
              <ul className="space-y-1.5 text-sm">
                {phoneEntries.map((entry) => {
                  const isActive =
                    activeSmsPhone != null && entry.e164 === activeSmsPhone;
                  return (
                    <li
                      key={entry.e164}
                      className={cn(
                        "flex items-start gap-2",
                        isActive && "font-medium text-foreground",
                      )}
                    >
                      <Phone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {entry.display}
                        {entry.label !== "Phone" ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {entry.label}
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            (SMS)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </DetailSection>
          ) : null}

          {emailEntries.length > 0 ? (
            <DetailSection label="Email">
              <ul className="space-y-1.5 text-sm">
                {emailEntries.map((entry, index) => (
                  <li key={`${entry.email}-${index}`} className="flex gap-2">
                    <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${entry.email}`}
                      className="break-all text-foreground hover:underline"
                    >
                      {entry.email}
                    </a>
                    {entry.type?.trim() ? (
                      <span className="shrink-0 text-muted-foreground">
                        · {entry.type}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DetailSection>
          ) : null}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Link to={getPersonShowPath(contact)}>
              <UserRound className="mr-2 size-4" />
              Open contact
            </Link>
          </Button>
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
        <VoiceCallButton
          phoneNumber={callPhone}
          contactId={contact?.id ?? conversation?.contact_id}
          conversationId={conversation?.id}
          dealId={deal?.id ?? conversation?.deal_id}
        />
      </div>
    </div>
  );
};

export const ContextPanel = ({
  conversation,
  contact,
  deal,
  activeSmsPhone,
  open,
  onClose,
}: {
  conversation: Conversation | null;
  contact?: Contact;
  deal?: LbsDeal;
  activeSmsPhone?: string | null;
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
        activeSmsPhone={activeSmsPhone}
      />
    </div>
  </aside>
);
