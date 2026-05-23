import { cn } from "@/lib/utils";
import type { InboxTab } from "@/lbs/messages/messagesHubTypes";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";

const TABS: Array<{ id: InboxTab; label: string; disabled?: boolean; hint?: string }> = [
  { id: "all", label: "All" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp", disabled: true, hint: "Configure WhatsApp in Settings" },
  { id: "calls", label: "Calls" },
  { id: "team", label: "Team" },
  { id: "mine", label: "Mine" },
  { id: "unread", label: "Unread" },
];

export const InboxTabs = ({
  activeTab,
  onChange,
  counts,
}: {
  activeTab: InboxTab;
  onChange: (tab: InboxTab) => void;
  counts: Partial<Record<InboxTab, number>>;
}) => (
  <div className="flex flex-wrap gap-1 border-b border-border/40 px-2 py-2">
    {TABS.map((tab) => {
      const count = counts[tab.id] ?? 0;
      return (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          title={tab.disabled ? tab.hint : undefined}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            tab.disabled && "cursor-not-allowed opacity-50",
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {tab.label}
          {count > 0 ? (
            <span className="ml-1 opacity-80">· {formatUnreadBadgeCount(count)}</span>
          ) : null}
        </button>
      );
    })}
  </div>
);
