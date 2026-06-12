import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export const RelatedSection = ({
  title,
  count,
  onAdd,
  addHref,
  onViewAll,
  children,
  empty,
  forceShow = false,
}: {
  title: string;
  count: number;
  onAdd?: () => void;
  addHref?: string;
  onViewAll?: () => void;
  children: ReactNode;
  empty?: ReactNode;
  forceShow?: boolean;
}) => (
  <section>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        {count > 0 ? ` (${count})` : ""}
      </h3>
      {onAdd || addHref ? (
        addHref ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Add ${title.toLowerCase()}`}
          >
            <Link to={addHref}>
              <Plus className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Add ${title.toLowerCase()}`}
            onClick={onAdd}
          >
            <Plus className="size-4" />
          </Button>
        )
      ) : null}
    </div>
    <div>
      {(count > 0 || forceShow) ? children : (empty ?? null)}
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
    </div>
  </section>
);

export const RelatedEmptyState = ({ message }: { message: string }) => (
  <p className="text-sm text-muted-foreground">{message}</p>
);
