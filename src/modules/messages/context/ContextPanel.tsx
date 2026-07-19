import { Link } from "react-router";
import type { ReactNode } from "react";
import { ExternalLink, Phone, X } from "lucide-react";
import { useGetOne } from "ra-core";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { Company } from "@/components/atomic-crm/types";
import type { Contact, Conversation, LbsDeal } from "@/modules/types";
import { getContactPhoneEntries } from "@/modules/messages/messageContactUtils";
import { StatusBadge } from "@/modules/messages/status/StatusBadge";
import { useMaskedAmount } from "@/lib/permissions/useMaskedAmount";
import { getClientShowPath } from "@/app/routing";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";
import { VoiceCallButton } from "@/modules/voice/VoiceCallButton";
import { ConversationCallHistory } from "@/modules/voice/ConversationCallHistory";
import {
  CompanyContextCard,
  PersonContextCard,
} from "@/modules/shared/profile";

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

  const companyId = contact?.company_id;
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId as NonNullable<typeof companyId> },
    { enabled: companyId != null },
  );

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

  const hasRelated =
    deal != null || conversation?.id != null || callPhone != null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversation ? (
        <div className="shrink-0 space-y-2 border-b border-border/40 px-5 py-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Conversation
          </div>
          <div className="text-base font-semibold">
            {conversation.title ?? "Untitled"}
          </div>
          <StatusBadge status={conversation.status} />
          {conversation.type === "client" &&
          (activeSmsPhone ?? conversation.external_phone) ? (
            <p className="text-sm text-muted-foreground">
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

      <Tabs defaultValue="about" className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 border-b border-border/40 px-4 pt-3">
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="about" className="text-xs">
              About
            </TabsTrigger>
            <TabsTrigger value="related" className="text-xs">
              Related
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="about"
          className="min-h-0 flex-1 overflow-y-auto p-5 data-[state=inactive]:hidden"
        >
          <div className="space-y-5">
            {contact ? <PersonContextCard contact={contact} /> : null}

            {company ? (
              <CompanyContextCard
                companyId={company.id}
                name={company.name}
                website={company.website}
                isClient={company.is_client}
                viewProfileHref={getClientShowPath(company.id)}
                avatar={<CompanyAvatar record={company} width={40} />}
              />
            ) : null}

            {contact && phoneEntries.length > 1 ? (
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

            {!contact && !company ? (
              <p className="text-sm text-muted-foreground">
                No linked contact for this conversation.
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent
          value="related"
          className="min-h-0 flex-1 overflow-y-auto p-5 data-[state=inactive]:hidden"
        >
          <div className="space-y-5">
            {deal ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Project
                </div>
                <div className="mt-1 font-medium">{deal.name}</div>
                {deal.amount != null ? (
                  <div className="text-sm text-muted-foreground">
                    {maskedAmount}
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasRelated ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </div>
                {deal?.id != null ? (
                  <Button
                    asChild
                    variant="secondary"
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
                {conversation?.id != null ? (
                  <ConversationCallHistory conversationId={conversation.id} />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No linked project or call history yet.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
        "flex h-full w-[300px] flex-col overflow-hidden xl:w-[320px]",
        !open && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
        <span className="text-sm font-medium">Details</span>
        {onClose ? (
          <IconButton onClick={onClose} aria-label="Close details panel">
            <X className="size-4" />
          </IconButton>
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
