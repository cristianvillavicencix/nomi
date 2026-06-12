import { useGetList } from "ra-core";
import type { Identifier } from "ra-core";
import type { Deal } from "@/components/atomic-crm/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_PROJECTS = "all";

const getDealLabel = (deal: Deal) => deal.name?.trim() || `Project #${deal.id}`;

export const CalendarProjectFilter = ({
  value,
  onChange,
}: {
  value: Identifier | null;
  onChange: (projectId: Identifier | null) => void;
}) => {
  const { data: deals = [], isPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  return (
    <Select
      value={value != null ? String(value) : ALL_PROJECTS}
      onValueChange={(next) => onChange(next === ALL_PROJECTS ? null : next)}
      disabled={isPending}
    >
      <SelectTrigger className="w-full min-w-[160px] sm:w-[200px]">
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
        {deals.map((deal) => (
          <SelectItem key={deal.id} value={String(deal.id)}>
            {getDealLabel(deal)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
