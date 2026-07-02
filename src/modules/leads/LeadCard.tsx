import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router";
import { useDelete, useNotify, useRefresh } from "ra-core";
import {
  GripVertical,
  History,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";

import { Confirm } from "@/components/admin/confirm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import { getLeadShowPath } from "@/app/routing";
import { LeadActivitySheet } from "@/modules/leads/LeadActivitySheet";
import { useLeadKanbanContext } from "@/modules/leads/LeadKanbanContext";
import {
  formatLeadActivityFooter,
  getLeadAssigneeMemberId,
  getLeadDisplayName,
  getLeadInitials,
  getLeadPrimaryEmail,
  getLeadPrimaryPhoneDisplay,
  getLeadSourceIcon,
  getMemberAccentColor,
  getMemberInitials,
  getMemberDisplayName,
  isLeadActivityStale,
  resolveLeadLastActivity,
  shouldShowLeadEmail,
  shouldShowLeadQuoteAmount,
} from "@/modules/leads/leadCardUtils";
import { normalizeLeadStage } from "@/modules/leads/leadStages";
import { isLeadTerminalStage } from "@/modules/leads/leadFollowUpUtils";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useCrmPhoneCall } from "@/modules/voice/useCrmPhoneCall";

const cardActionClassName = (isDragging: boolean) =>
  cn(
    "grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity",
    "group-hover:opacity-100 focus-visible:opacity-100",
    "hover:bg-muted hover:text-foreground",
    isDragging && "opacity-100",
  );

const cardToolbarIconClassName =
  "size-7 shrink-0 rounded-none text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";

export type LeadCardProps = {
  lead: Contact;
  index: number;
};

export const LeadCard = ({ lead, index }: LeadCardProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [deleteOne, { isPending: isDeleting }] = useDelete<Contact>();
  const { membersById, conversationsByContactId, requestStageChange } =
    useLeadKanbanContext();
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const canViewAmounts = useCanViewAmounts();

  const stage = normalizeLeadStage(lead.lead_stage);
  const isTerminal = isLeadTerminalStage(lead.lead_stage);
  const name = getLeadDisplayName(lead);
  const phone = getLeadPrimaryPhoneDisplay(lead);
  const email = getLeadPrimaryEmail(lead);
  const source = getLeadSourceIcon(lead.lead_source);
  const SourceIcon = source.Icon;
  const assigneeId = getLeadAssigneeMemberId(lead);
  const assignee = assigneeId ? membersById[String(assigneeId)] : undefined;
  const conversation = conversationsByContactId[String(lead.id)];
  const activity = resolveLeadLastActivity(lead, conversation);
  const activityStale = isLeadActivityStale(activity.at);
  const showEmail = shouldShowLeadEmail(lead);
  const showQuote = shouldShowLeadQuoteAmount(lead);
  const { canCall, voiceReady, callPhone } = useCrmPhoneCall();
  const canCallPhone = Boolean(phone?.e164 && canCall && voiceReady);

  const handleDelete = () => {
    deleteOne(
      "contacts",
      { id: lead.id, previousData: lead },
      {
        onSuccess: () => {
          notify("Lead deleted", { type: "info" });
          refresh();
          setDeleteOpen(false);
        },
        onError: () => {
          notify("Failed to delete lead", { type: "error" });
        },
      },
    );
  };

  const stopCardNavigation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const stopCardAction = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const stopDragHandleClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const openSms = async (event: MouseEvent) => {
    stopCardAction(event);
    if (!contactHasSmsPhone(lead)) {
      notify("This lead has no valid phone number for SMS", {
        type: "warning",
      });
      return;
    }
    if (messagesQuickAccess) {
      await messagesQuickAccess.openSms(lead);
      return;
    }
    notify("Open Messages to text this lead", { type: "info" });
  };

  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => {
        const openLead = () => {
          if (snapshot.isDragging) return;
          navigate(getLeadShowPath(lead.id));
        };

        return (
          <div ref={provided.innerRef} {...provided.draggableProps}>
            <Card
              role="button"
              tabIndex={0}
              onClick={openLead}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLead();
                }
              }}
              className={cn(
                "group relative cursor-pointer gap-0 rounded-lg border-[0.5px] border-border/80 p-2 shadow-none transition-shadow",
                snapshot.isDragging
                  ? "rotate-1 shadow-xl ring-2 ring-primary/40"
                  : "hover:shadow-sm",
              )}
            >
              <div className="absolute right-0.5 top-0.5 z-10 flex flex-col gap-0.5">
                <div
                  {...provided.dragHandleProps}
                  onClick={stopDragHandleClick}
                  onMouseDown={stopDragHandleClick}
                  className={cn(
                    cardActionClassName(snapshot.isDragging),
                    "cursor-grab active:cursor-grabbing",
                  )}
                  aria-label="Drag lead"
                  role="button"
                  tabIndex={0}
                >
                  <GripVertical className="size-3.5" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    cardActionClassName(snapshot.isDragging),
                    "size-6",
                  )}
                  title="Activity history"
                  onClick={(event) => {
                    stopCardAction(event);
                    setHistoryOpen(true);
                  }}
                >
                  <History className="size-3.5" />
                  <span className="sr-only">Activity history</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    cardActionClassName(snapshot.isDragging),
                    "size-6 hover:text-destructive",
                  )}
                  title="Delete lead"
                  disabled={isDeleting}
                  onClick={(event) => {
                    stopCardAction(event);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span className="sr-only">Delete lead</span>
                </Button>
              </div>

              <div className="pr-5">
                <div className="flex items-start gap-2">
                  <Avatar className="size-[34px] shrink-0">
                    <AvatarFallback className="bg-muted text-[11px] font-semibold">
                      {getLeadInitials(lead)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 truncate text-sm font-medium leading-snug group-hover:underline">
                        {name}
                      </p>
                      <SourceIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label={source.label}
                        title={source.label}
                      />
                    </div>
                    {lead.interested_service ? (
                      <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
                        {lead.interested_service}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1.5 space-y-0.5">
                  {phone ? (
                    <div className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      <span className="truncate">{phone.display}</span>
                    </div>
                  ) : null}

                  {showEmail && email ? (
                    <div className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                  ) : null}

                  {showQuote && canViewAmounts ? (
                    <div className="text-xs font-medium leading-snug text-foreground">
                      <MoneyText value={lead.lead_value_estimate} compact />
                    </div>
                  ) : null}

                  <div className="flex items-center gap-1.5">
                    {assignee ? (
                      <>
                        <Avatar className="size-5">
                          <AvatarFallback
                            className="text-[9px] font-semibold text-white"
                            style={{
                              backgroundColor: getMemberAccentColor(
                                assignee.id,
                              ),
                            }}
                          >
                            {getMemberInitials(assignee)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[11px] leading-snug text-muted-foreground">
                          {getMemberDisplayName(assignee)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>

                {stage !== "new" ? (
                  <p
                    className={cn(
                      "mt-1.5 text-[11px] leading-snug",
                      activityStale
                        ? "font-medium text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatLeadActivityFooter(activity)}
                  </p>
                ) : null}

                {!isTerminal ? (
                  <div
                    className="-mx-2 -mb-2 mt-1.5 flex items-stretch border-t border-border/60"
                    onClick={stopCardNavigation}
                    onPointerDown={stopCardNavigation}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(cardToolbarIconClassName, "flex-1 rounded-bl-lg")}
                      title="Call"
                      disabled={!canCallPhone}
                      onClick={(event) => {
                        stopCardAction(event);
                        if (phone?.e164) {
                          void callPhone({
                            to: phone.e164,
                            contactId: lead.id,
                          });
                        }
                      }}
                    >
                      <PhoneCall className="size-3.5" />
                      <span className="sr-only">Call</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        cardToolbarIconClassName,
                        "flex-1 border-l border-border/60",
                      )}
                      title="SMS"
                      disabled={!contactHasSmsPhone(lead)}
                      onClick={openSms}
                    >
                      <MessageSquare className="size-3.5" />
                      <span className="sr-only">SMS</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        cardToolbarIconClassName,
                        "flex-1 border-l border-border/60 text-emerald-600 hover:text-emerald-700 dark:text-emerald-500",
                      )}
                      title="Mark as won"
                      onClick={(event) => {
                        stopCardAction(event);
                        requestStageChange(lead, "won");
                      }}
                    >
                      <Trophy className="size-3.5" />
                      <span className="sr-only">Mark as won</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        cardToolbarIconClassName,
                        "flex-1 rounded-br-lg border-l border-border/60 text-destructive hover:text-destructive",
                      )}
                      title="Mark as lost"
                      onClick={(event) => {
                        stopCardAction(event);
                        requestStageChange(lead, "lost");
                      }}
                    >
                      <XCircle className="size-3.5" />
                      <span className="sr-only">Mark as lost</span>
                    </Button>
                  </div>
                ) : null}
              </div>

              <LeadActivitySheet
                lead={lead}
                open={historyOpen}
                onOpenChange={setHistoryOpen}
              />
              <Confirm
                isOpen={deleteOpen}
                title="Delete this lead?"
                content="This action cannot be undone."
                confirm="Delete"
                confirmColor="warning"
                onConfirm={handleDelete}
                onClose={() => setDeleteOpen(false)}
                loading={isDeleting}
              />
            </Card>
          </div>
        );
      }}
    </Draggable>
  );
};
