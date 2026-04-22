import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const PeopleQuickNavSearch = ({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) => (
  <label className="relative block">
    <span className="sr-only">{label}</span>
    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 pl-8"
      aria-label={label}
    />
  </label>
);

