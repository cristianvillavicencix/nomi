import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAIL_THREADS_PER_PAGE_OPTIONS,
  mailThreadsPageLabel,
  type MailThreadsPageResult,
} from "./mailListPagination";

export function MailThreadListPagination({
  result,
  onPageChange,
  onPerPageChange,
}: {
  result: MailThreadsPageResult;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}) {
  if (result.total <= 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/10 px-2 py-2">
      <div className="hidden items-center gap-1.5 sm:flex">
        <span className="text-[11px] text-muted-foreground">Rows</span>
        <Select
          value={String(result.perPage)}
          onValueChange={(value) => onPerPageChange(Number(value))}
        >
          <SelectTrigger className="h-7 w-[4.5rem] px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {MAIL_THREADS_PER_PAGE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {mailThreadsPageLabel(result)}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!result.hasPreviousPage}
          aria-label="Previous page"
          onClick={() => onPageChange(result.page - 1)}
        >
          <ChevronLeftIcon className="size-3.5" />
        </Button>
        <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-muted-foreground">
          Page {result.page}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!result.hasNextPage}
          aria-label="Next page"
          onClick={() => onPageChange(result.page + 1)}
        >
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
