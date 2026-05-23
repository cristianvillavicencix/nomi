import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InboxFilterState } from "@/lbs/messages/messagesHubTypes";
import type { OrganizationMember } from "@/lbs/types";

export const InboxFilters = ({
  filters,
  onChange,
  members,
}: {
  filters: InboxFilterState;
  onChange: (next: InboxFilterState) => void;
  members: OrganizationMember[];
}) => (
  <div className="grid grid-cols-2 gap-2 px-3 py-2">
    <Select
      value={filters.status}
      onValueChange={(status) => onChange({ ...filters, status })}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="urgent">Urgent</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>

    <Select
      value={filters.assigneeMemberId}
      onValueChange={(assigneeMemberId) => onChange({ ...filters, assigneeMemberId })}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Assignee" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Any assignee</SelectItem>
        <SelectItem value="mine">Assigned to me</SelectItem>
        {members.map((member) => (
          <SelectItem key={String(member.id)} value={String(member.id)}>
            {[member.first_name, member.last_name].filter(Boolean).join(" ") || `#${member.id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
