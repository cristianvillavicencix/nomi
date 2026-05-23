import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  InboxFilterState,
  InboxTab,
} from "@/lbs/messages/messagesHubTypes";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import type { OrganizationMember } from "@/lbs/types";

const TABS: Array<{ id: InboxTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "team", label: "Team" },
];

const textFilterTriggerClass =
  "inline cursor-pointer border-0 bg-transparent p-0 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-2";

const getAssigneeLabel = (
  assigneeMemberId: InboxFilterState["assigneeMemberId"],
  members: OrganizationMember[],
) => {
  if (assigneeMemberId === "all") return "Any assignee";
  if (assigneeMemberId === "mine") return "Assigned to me";
  const member = members.find((entry) => String(entry.id) === assigneeMemberId);
  if (!member) return "Assignee";
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    `#${member.id}`
  );
};

export const InboxTabs = ({
  activeTab,
  onChange,
  counts,
  filters,
  onFiltersChange,
  members,
}: {
  activeTab: InboxTab;
  onChange: (tab: InboxTab) => void;
  counts: Partial<Record<InboxTab, number>>;
  filters: InboxFilterState;
  onFiltersChange: (next: InboxFilterState) => void;
  members: OrganizationMember[];
}) => {
  const assigneeLabel = getAssigneeLabel(filters.assigneeMemberId, members);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/30 bg-background px-3 py-2 md:px-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const count = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {tab.label}
              {count > 0 ? (
                <span className="ml-1 opacity-80">
                  · {formatUnreadBadgeCount(count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <DropdownMenu>
          <DropdownMenuTrigger className={textFilterTriggerClass}>
            {assigneeLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-64 w-48 overflow-y-auto"
          >
            <DropdownMenuItem
              onSelect={() =>
                onFiltersChange({ ...filters, assigneeMemberId: "all" })
              }
            >
              Any assignee
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onFiltersChange({ ...filters, assigneeMemberId: "mine" })
              }
            >
              Assigned to me
            </DropdownMenuItem>
            {members.map((member) => (
              <DropdownMenuItem
                key={String(member.id)}
                onSelect={() =>
                  onFiltersChange({
                    ...filters,
                    assigneeMemberId: String(member.id),
                  })
                }
              >
                {[member.first_name, member.last_name]
                  .filter(Boolean)
                  .join(" ") || `#${member.id}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
