import { useState } from "react";
import { FileText, Info, MessageSquare } from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { TicketBillingSidePanel } from "@/modules/tickets/TicketBillingSidePanel";
import { TicketClientSummaryCard } from "@/modules/tickets/TicketClientSummaryCard";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type ContextTab = "billing" | "sms" | "info";

const CONTEXT_TABS: Array<{ id: ContextTab; label: string; icon: typeof FileText }> =
  [
    { id: "billing", label: "Billing", icon: FileText },
    { id: "sms", label: "SMS", icon: MessageSquare },
    { id: "info", label: "Info", icon: Info },
  ];

const TicketContextTabs = ({
  activeTab,
  onChange,
  className,
}: {
  activeTab: ContextTab;
  onChange: (tab: ContextTab) => void;
  className?: string;
}) => (
  <div className={cn("flex shrink-0 gap-1 border-b px-2 py-2", className)}>
    {CONTEXT_TABS.map((tab) => {
      const Icon = tab.icon;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
            activeTab === tab.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          {tab.label}
        </button>
      );
    })}
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <TicketClientSummaryCard ticket={ticket} company={company} contact={contact} />
    </div>
  );
};

export const TicketContextPanel = ({
  ticket,
  company,
  contact,
  className,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  className?: string;
}) => {
  const [activeTab, setActiveTab] = useState<ContextTab>("billing");

  return (
    <aside
      className={cn(
        "flex w-[min(50%,22rem)] shrink-0 flex-col self-stretch overflow-hidden border-l bg-background",
        className,
      )}
    >
      <TicketContextTabs activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TicketContextBody
          activeTab={activeTab}
          ticket={ticket}
          company={company}
          contact={contact}
        />
      </div>
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
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ContextTab>("billing");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <Info className="size-3.5" />
          Context
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Ticket context</SheetTitle>
        </SheetHeader>
        <TicketContextTabs activeTab={activeTab} onChange={setActiveTab} />
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
