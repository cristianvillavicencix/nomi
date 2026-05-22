import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskMentionText } from "@/components/atomic-crm/tasks/TaskMentionText";
import { cn } from "@/lib/utils";

export const TaskDescriptionCell = ({
  text,
  isDone = false,
  useMentions = true,
  footer,
  fadeSurface = "background",
}: {
  text?: string | null;
  isDone?: boolean;
  useMentions?: boolean;
  footer?: ReactNode;
  fadeSurface?: "background" | "card";
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  if (!text?.trim()) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const renderedText = useMentions ? (
    <TaskMentionText text={text} />
  ) : (
    text
  );

  return (
    <>
      <div className="min-w-0 max-w-full">
        <div className="relative min-w-0">
          <button
            type="button"
            className={cn(
              "block w-full min-w-0 rounded-sm text-left text-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isDone && "text-muted-foreground",
            )}
            onClick={() => setPreviewOpen(true)}
            aria-label="View full task description"
          >
            <div
              ref={contentRef}
              className={cn(
                "truncate pr-8",
                isDone && "line-through",
              )}
            >
              {renderedText}
            </div>
          </button>
          {isOverflowing ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l to-transparent",
                fadeSurface === "card"
                  ? "from-card via-card/70"
                  : "from-background via-background/70",
              )}
            />
          ) : null}
        </div>
        {footer ? <div className="mt-1">{footer}</div> : null}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Task description</DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap break-words",
              isDone && "line-through text-muted-foreground",
            )}
          >
            {renderedText}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
