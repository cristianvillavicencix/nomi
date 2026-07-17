import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const RelatedAccordion = ({
  defaultValue,
  children,
  className,
}: {
  defaultValue?: string[];
  children: ReactNode;
  className?: string;
}) => (
  <Accordion
    type="multiple"
    defaultValue={defaultValue}
    className={cn("space-y-2", className)}
  >
    {children}
  </Accordion>
);

export const RelatedSection = ({
  value,
  title,
  count,
  onAdd,
  addHref,
  onViewAll,
  children,
  empty,
  forceShow = false,
}: {
  /** Accordion item value. When omitted, renders as a static card (legacy). */
  value?: string;
  title: string;
  count: number;
  onAdd?: () => void;
  addHref?: string;
  onViewAll?: () => void;
  children: ReactNode;
  empty?: ReactNode;
  forceShow?: boolean;
}) => {
  const addControl =
    onAdd || addHref ? (
      addHref ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          aria-label={`Add ${title.toLowerCase()}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Link to={addHref}>
            <Plus className="size-3.5" />
            Add
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          aria-label={`Add ${title.toLowerCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      )
    ) : null;

  const body = (
    <>
      {count > 0 || forceShow ? children : (empty ?? null)}
      {count > 0 && onViewAll ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0 link-action"
          onClick={onViewAll}
        >
          View all
        </Button>
      ) : null}
    </>
  );

  if (!value) {
    return (
      <section className="rounded-xl border border-border bg-card px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
            {count > 0 ? ` (${count})` : ""}
          </h3>
          {addControl}
        </div>
        <div>{body}</div>
      </section>
    );
  }

  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-border border-b-0 bg-card px-3 last:border-b-0"
    >
      <div className="flex items-center gap-1">
        <AccordionTrigger className="flex-1 py-3 hover:no-underline [&>svg]:size-4">
          <span className="text-sm font-medium text-foreground">
            {title}
            <span className="ml-1 tabular-nums text-muted-foreground">
              ({count})
            </span>
          </span>
        </AccordionTrigger>
        {addControl}
      </div>
      <AccordionContent className="pb-3">{body}</AccordionContent>
    </AccordionItem>
  );
};

export const RelatedEmptyState = ({ message }: { message: string }) => (
  <p className="text-sm text-muted-foreground">{message}</p>
);
