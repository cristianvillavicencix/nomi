import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type BillingStatusFilterOption<T extends string> = {
  value: T;
  label: string;
};

type BillingStatusFilterMenuProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: Array<BillingStatusFilterOption<T>>;
  counts: Record<T, number>;
  ariaLabel?: string;
};

export const BillingStatusFilterMenu = <T extends string>({
  value,
  onChange,
  options,
  counts,
  ariaLabel = "Filter list",
}: BillingStatusFilterMenuProps<T>) => {
  const activeOption = options.find((option) => option.value === value);
  const isFiltered = value !== options[0]?.value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={isFiltered ? "secondary" : "outline"}
          size="icon"
          className={cn("shrink-0", isFiltered && "border-primary/30")}
          aria-label={
            activeOption && isFiltered
              ? `${ariaLabel}: ${activeOption.label}`
              : ariaLabel
          }
        >
          <ListFilter className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn("justify-between", active && "font-medium")}
            >
              <span>{option.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {counts[option.value]}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
