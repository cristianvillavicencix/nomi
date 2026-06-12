import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LeadFormSectionProps = {
  title: string;
  children: ReactNode;
  /** When false, section is always expanded and has no collapse control. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

export const LeadFormSection = ({
  title,
  children,
  collapsible = true,
  defaultOpen = true,
  className,
}: LeadFormSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </section>
    );
  }

  return (
    <section className={cn("rounded-lg border bg-muted/15", className)}>
      <Button
        type="button"
        variant="ghost"
        className="flex h-10 w-full items-center justify-between rounded-lg px-3 py-2"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>
      {open ? <div className="space-y-3 border-t px-3 pb-3 pt-2">{children}</div> : null}
    </section>
  );
};
