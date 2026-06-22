import { Draggable } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import { cn } from "@/lib/utils";
import type { Deal } from "../types";
import {
  formatDealCardFooter,
  getDealCompanyInitials,
  getDealCompanyLabel,
  getDealProjectTypeLabel,
} from "@/modules/deals/dealCardUtils";
import { useDealKanbanContext } from "@/modules/deals/DealKanbanContext";
import {
  getMemberAccentColor,
  getMemberDisplayName,
  getMemberInitials,
} from "@/modules/leads/leadCardUtils";

const cardActionClassName = (isDragging: boolean) =>
  cn(
    "grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity",
    "group-hover:opacity-100 focus-visible:opacity-100",
    "hover:bg-muted hover:text-foreground",
    isDragging && "opacity-100",
  );

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent
          provided={provided}
          snapshot={snapshot}
          deal={deal}
        />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: {
    innerRef: (element: HTMLElement | null) => void;
    draggableProps: Record<string, unknown>;
    dragHandleProps: Record<string, unknown> | null;
  };
  snapshot?: { isDragging?: boolean };
  deal: Deal;
}) => {
  const canViewAmounts = useCanViewAmounts();
  const navigate = useNavigate();
  const { membersById } = useDealKanbanContext();
  const isDragging = Boolean(snapshot?.isDragging);
  const companyLabel = getDealCompanyLabel(deal);
  const projectTypeLabel = getDealProjectTypeLabel(deal);
  const assignee =
    deal.organization_member_id != null
      ? membersById[String(deal.organization_member_id)]
      : undefined;
  const footer = formatDealCardFooter(deal);

  const openDeal = () => {
    if (isDragging) return;
    navigate(`/deals/${deal.id}/show`, {
      state: { _scrollToTop: false },
    });
  };

  const stopDragHandleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div ref={provided?.innerRef} {...provided?.draggableProps}>
      <Card
        role="button"
        tabIndex={0}
        onClick={openDeal}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDeal();
          }
        }}
        className={cn(
          "group relative cursor-pointer gap-0 rounded-lg border-[0.5px] border-border/80 p-2 shadow-none transition-shadow",
          isDragging
            ? "rotate-1 shadow-xl ring-2 ring-primary/40"
            : "hover:shadow-sm",
        )}
      >
        {provided?.dragHandleProps ? (
          <div className="absolute right-0.5 top-0.5 z-10">
            <div
              {...provided.dragHandleProps}
              onClick={stopDragHandleClick}
              onMouseDown={stopDragHandleClick}
              className={cn(
                cardActionClassName(isDragging),
                "cursor-grab active:cursor-grabbing",
              )}
              aria-label="Drag project"
              role="button"
              tabIndex={0}
            >
              <GripVertical className="size-3.5" />
            </div>
          </div>
        ) : null}

        <div className={cn(provided?.dragHandleProps && "pr-5")}>
          <div className="flex items-start gap-2">
            <Avatar className="size-[34px] shrink-0">
              <AvatarFallback className="bg-muted text-[11px] font-semibold">
                {getDealCompanyInitials(deal)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="block min-w-0 truncate text-sm font-medium leading-snug group-hover:underline">
                {deal.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
                {companyLabel}
              </p>
            </div>
          </div>

          <div className="mt-1.5 space-y-0.5">
            {projectTypeLabel ? (
              <p className="truncate text-[11px] leading-snug text-muted-foreground">
                {projectTypeLabel}
              </p>
            ) : null}

            {canViewAmounts && deal.amount != null ? (
              <div className="text-xs font-medium leading-snug text-foreground">
                <MoneyText value={deal.amount} compact />
              </div>
            ) : null}

            <div className="flex items-center gap-1.5">
              {assignee ? (
                <>
                  <Avatar className="size-5">
                    <AvatarFallback
                      className="text-[9px] font-semibold text-white"
                      style={{
                        backgroundColor: getMemberAccentColor(assignee.id),
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

          <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] leading-snug text-muted-foreground">
            {footer}
          </p>
        </div>
      </Card>
    </div>
  );
};
