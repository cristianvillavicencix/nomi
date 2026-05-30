import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatTabCount } from "@/lbs/clients/clientShowUtils";

type ClientTabAccordionProps = {
  value: string[];
  onValueChange: (value: string[]) => void;
  children: ReactNode;
};

export const ClientTabAccordion = ({
  value,
  onValueChange,
  children,
}: ClientTabAccordionProps) => (
  <Accordion
    type="multiple"
    value={value}
    onValueChange={onValueChange}
    className="space-y-0"
  >
    {children}
  </Accordion>
);

type ClientTabAccordionSectionProps = {
  value: string;
  title: string;
  count?: number;
  children: ReactNode;
};

export const ClientTabAccordionSection = ({
  value,
  title,
  count,
  children,
}: ClientTabAccordionSectionProps) => (
  <AccordionItem
    value={value}
    className="border-b border-border/70 last:border-b-0"
  >
    <AccordionTrigger className="group flex w-full items-center justify-start gap-2 px-0 py-3.5 text-left hover:no-underline [&>svg:last-child]:hidden">
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      <span className="text-base font-semibold">
        {title}
        {formatTabCount(count)}
      </span>
    </AccordionTrigger>
    <AccordionContent className="pb-5">
      <div className="space-y-3">{children}</div>
    </AccordionContent>
  </AccordionItem>
);
