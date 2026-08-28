import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Info,
  MessageSquare,
  PanelRightClose,
  Paperclip,
} from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { TicketBillingSidePanel } from "@/modules/tickets/TicketBillingSidePanel";
import { TicketClientSummaryCard } from "@/modules/tickets/TicketClientSummaryCard";
import { TicketFilesSidePanel } from "@/modules/tickets/TicketFilesSidePanel";
import { TicketInfoProperties } from "@/modules/tickets/TicketInfoProperties";
import { TicketRelatedTicketsList } from "@/modules/tickets/TicketRelatedTicketsList";
import {
  TICKET_OPEN_BILLING_EVENT,
  type TicketComposerEventDetail,
} from "@/modules/tickets/ticketComposerEvents";
import { cn } from "@/lib/utils";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ContextTab = "billing" | "sms" | "info" | "files";

import {
  TICKET_CONTEXT_OVERLAY_CLASS,
  TICKET_CONTEXT_PANEL_CLASS,
  TICKET_CONTEXT_RAIL_CLASS,
  ticketContextPanelTransition,
} from "@/modules/tickets/ticketContextLayout";

const ALL_CONTEXT_TABS: Array<{
  id: ContextTab;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "billing", label: "Billing", icon: FileText },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "info", label: "Info", icon: Info },
  { id: "files", label: "Files", icon: Paperclip },
];

const defaultContextTab = (
  tabs: Array<(typeof ALL_CONTEXT_TABS)[number]>,
): ContextTab => tabs[0]?.id ?? "info";

const TicketContextTabs = ({
  tabs,
  activeTab,
  onChange,
  onCollapse,
  className,
}: {
  tabs: Array<(typeof ALL_CONTEXT_TABS)[number]>;
  activeTab: ContextTab;
  onChange: (tab: ContextTab) => void;
  onCollapse?: () => void;
  className?: string;
}) => (
  <div
    className={cn(
      "flex shrink-0 items-center gap-1 border-b px-2 py-2",
      className,
    )}
  >
    <div className="flex min-w-0 flex-1 gap-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => onChange(tab.id)}
                aria-label={tab.label}
                className={cn(
                  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors sm:gap-1.5 sm:px-2 sm:text-xs",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tab.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    {onCollapse ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            className="shrink-0"
            aria-label="Minimize context panel"
            onClick={onCollapse}
          >
            <PanelRightClose className="size-4" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent side="left">Minimize panel</TooltipContent>
      </Tooltip>
    ) : null}
  </div>
);

const TicketContextBody = ({
  activeTab,
  ticket,
  company,
  contact,
}: {
  activeTab: ContextTab;
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
}) => {
  if (activeTab === "billing") {
    return (
      <TicketBillingSidePanel
        ticket={ticket}
        company={company}
        contact={contact}
        embedMode
        embedView="invoice"
      />
    );
  }

  if (activeTab === "sms") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TicketBillingSidePanel
          ticket={ticket}
          company={company}
          contact={contact}
          embedMode
          embedView="sms"
          className="min-h-0 flex-1"
        />
      </div>
    );
  }

  if (activeTab === "files") {
    return <TicketFilesSidePanel ticket={ticket} />;
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <TicketInfoProperties ticket={ticket} />
      <TicketClientSummaryCard
        ticket={ticket}
        company={company}
        contact={contact}
        variant="panel"
      />
      <TicketRelatedTicketsList ticket={ticket} />
    </div>
  );
};

const TicketContextRailContent = ({
  tabs,
  onOpenTab,
}: {
  tabs: Array<(typeof ALL_CONTEXT_TABS)[number]>;
  onOpenTab: (tab: ContextTab) => void;
}) => (
  <>
    <div className="flex flex-1 flex-col items-center gap-2 py-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <IconButton
                className="size-9"
                aria-label={`Open ${tab.label}`}
                onClick={() => onOpenTab(tab.id)}
              >
                <Icon className="size-4" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent side="left">{tab.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    <span className="pb-3 text-center text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
      Context
    </span>
  </>
);

const TicketContextCollapsedRail = ({
  tabs,
  onOpenTab,
}: {
  tabs: Array<(typeof ALL_CONTEXT_TABS)[number]>;
  onOpenTab: (tab: ContextTab) => void;
}) => (
  <aside
    className={cn(
      "flex shrink-0 flex-col self-stretch border-l bg-background",
      TICKET_CONTEXT_RAIL_CLASS,
    )}
  >
    <TicketContextRailContent tabs={tabs} onOpenTab={onOpenTab} />
  </aside>
);

export const TicketContextPanel = ({
  ticket,
  company,
  contact,
  className,
  /** Overlay the panel over the thread instead of shrinking it (inbox split). */
  overlay = false,
  /** Animate width when expanding/collapsing (push layout). */
  animateResize = true,
  onExpandedChange,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  className?: string;
  overlay?: boolean;
  animateResize?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) => {
  const canViewAmounts = useCanViewAmounts();
  const contextTabs = useMemo(
    () =>
      canViewAmounts
        ? ALL_CONTEXT_TABS
        : ALL_CONTEXT_TABS.filter((tab) => tab.id !== "billing"),
    [canViewAmounts],
  );
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ContextTab>(() =>
    defaultContextTab(contextTabs),
  );

  useEffect(() => {
    setCollapsed(true);
    setActiveTab(defaultContextTab(contextTabs));
  }, [ticket.id, contextTabs]);

  useEffect(() => {
    onExpandedChange?.(!collapsed);
  }, [collapsed, onExpandedChange]);

  useEffect(() => {
    const handleOpenBilling = (event: Event) => {
      const detail = (event as CustomEvent<TicketComposerEventDetail>).detail;
      if (detail.ticketId !== ticket.id) return;
      setActiveTab("billing");
      setCollapsed(false);
    };

    window.addEventListener(TICKET_OPEN_BILLING_EVENT, handleOpenBilling);
    return () =>
      window.removeEventListener(TICKET_OPEN_BILLING_EVENT, handleOpenBilling);
  }, [ticket.id]);

  const openTab = (tab: ContextTab) => {
    setActiveTab(tab);
    setCollapsed(false);
  };

  const panelBody = (
    <>
      <TicketContextTabs
        tabs={contextTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        onCollapse={() => setCollapsed(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TicketContextBody
          activeTab={activeTab}
          ticket={ticket}
          company={company}
          contact={contact}
        />
      </div>
    </>
  );

  if (overlay) {
    return (
      <div className={cn("relative flex shrink-0 self-stretch", className)}>
        {/* Rail keeps its width so the thread does not resize on open. */}
        <TicketContextCollapsedRail tabs={contextTabs} onOpenTab={openTab} />
        {!collapsed ? (
          <aside
            className={cn(
              "absolute inset-y-0 right-0 z-30 flex flex-col overflow-hidden border-l bg-background shadow-xl",
              TICKET_CONTEXT_OVERLAY_CLASS,
            )}
          >
            {panelBody}
          </aside>
        ) : null}
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col self-stretch overflow-hidden border-l bg-background",
        animateResize && ticketContextPanelTransition,
        collapsed ? TICKET_CONTEXT_RAIL_CLASS : TICKET_CONTEXT_PANEL_CLASS,
        className,
      )}
    >
      {collapsed ? (
        <TicketContextRailContent tabs={contextTabs} onOpenTab={openTab} />
      ) : (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            animateResize &&
              "animate-in fade-in slide-in-from-right-3 duration-300 motion-reduce:animate-none",
          )}
        >
          {panelBody}
        </div>
      )}
    </aside>
  );
};

export const TicketContextSheet = ({
  ticket,
  company,
  contact,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
}) => {
  const canViewAmounts = useCanViewAmounts();
  const contextTabs = useMemo(
    () =>
      canViewAmounts
        ? ALL_CONTEXT_TABS
        : ALL_CONTEXT_TABS.filter((tab) => tab.id !== "billing"),
    [canViewAmounts],
  );
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ContextTab>(() =>
    defaultContextTab(contextTabs),
  );

  useEffect(() => {
    setActiveTab(defaultContextTab(contextTabs));
  }, [ticket.id, contextTabs]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5"
        >
          <Info className="size-3.5" />
          Context
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Ticket context</SheetTitle>
          <SheetDescription className="sr-only">
            Billing, messaging, files, and related ticket information.
          </SheetDescription>
        </SheetHeader>
        <TicketContextTabs
          tabs={contextTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TicketContextBody
            activeTab={activeTab}
            ticket={ticket}
            company={company}
            contact={contact}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
