import { Globe, Megaphone, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingServiceOption = {
  id: number | null;
  name: string;
  description?: string | null;
  category?: string | null;
};

const serviceIcon = (category?: string | null) => {
  if (category === "marketing") return Megaphone;
  if (category === "web") return Globe;
  return Search;
};

type BookingServicePickerProps = {
  services: BookingServiceOption[];
  selected: BookingServiceOption | null;
  onSelect: (service: BookingServiceOption) => void;
};

export const BookingServicePicker = ({
  services,
  selected,
  onSelect,
}: BookingServicePickerProps) => (
  <div className="grid gap-3">
    {services.map((service) => {
      const Icon = serviceIcon(service.category);
      const isSelected = selected?.name === service.name;
      return (
        <button
          key={`${service.id ?? "custom"}-${service.name}`}
          type="button"
          onClick={() => onSelect(service)}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            isSelected
              ? "border-primary bg-primary/5 shadow-sm"
              : "hover:border-muted-foreground/20 hover:bg-muted/30",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                isSelected ? "bg-primary/10" : "bg-muted",
              )}
            >
              <Icon
                className={cn(
                  "size-5",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{service.name}</p>
              {service.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>
              ) : null}
            </div>
          </div>
        </button>
      );
    })}
  </div>
);
