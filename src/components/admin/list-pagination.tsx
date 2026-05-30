import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useListPaginationContext, Translate, useTranslate } from "ra-core";

/**
 * A pagination component with page numbers and rows per page selector.
 *
 * Displays pagination controls with previous/next buttons, page numbers with ellipsis for long lists,
 * and a dropdown to change items per page. Works with List context.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/listpagination/ ListPagination documentation}
 *
 * @example
 * import { List, ListPagination } from '@/components/admin';
 *
 * const PostListPagination = () => (
 *   <ListPagination rowsPerPageOptions={[5, 10, 25]} />
 * );
 *
 * export const PostList = () => (
 *   <List pagination={<PostListPagination />}>
 *     // ...
 *   </List>
 * );
 */
export const ListPagination = ({
  rowsPerPageOptions = [5, 10, 25, 50],
  className,
}: {
  rowsPerPageOptions?: number[];
  className?: string;
}) => {
  const translate = useTranslate();
  const {
    hasPreviousPage,
    hasNextPage,
    page,
    perPage,
    setPerPage,
    total,
    setPage,
  } = useListPaginationContext();

  const pageStart = (page - 1) * perPage + 1;
  const pageEnd = hasNextPage ? page * perPage : total;

  const boundaryCount = 1;
  const siblingCount = 1;
  const count = total ? Math.ceil(total / perPage) : 1;

  const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, i) => start + i);
  };

  const startPages = range(1, Math.min(boundaryCount, count));
  const endPages = range(
    Math.max(count - boundaryCount + 1, boundaryCount + 1),
    count,
  );

  const siblingsStart = Math.max(
    Math.min(
      // Natural start
      page - siblingCount,
      // Lower boundary when page is high
      count - boundaryCount - siblingCount * 2 - 1,
    ),
    // Greater than startPages
    boundaryCount + 2,
  );

  const siblingsEnd = Math.min(
    Math.max(
      // Natural end
      page + siblingCount,
      // Upper boundary when page is low
      boundaryCount + siblingCount * 2 + 2,
    ),
    // Less than endPages
    count - boundaryCount - 1,
  );

  const siblingPages = range(siblingsStart, siblingsEnd);

  const pageChangeHandler = (newPage: number) => {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setPage(newPage);
    };
  };

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 sm:gap-3",
        className,
      )}
    >
      <div className="hidden items-center gap-1.5 md:flex">
        <p className="text-xs font-medium text-muted-foreground">
          <Translate i18nKey="ra.navigation.page_rows_per_page">
            Rows per page
          </Translate>
        </p>
        <Select
          value={perPage.toString()}
          onValueChange={(value) => {
            setPerPage(Number(value));
          }}
        >
          <SelectTrigger className="h-7 w-fit px-2 text-xs">
            <SelectValue placeholder={perPage} />
          </SelectTrigger>
          <SelectContent side="top">
            {rowsPerPageOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        <Translate
          i18nKey="ra.navigation.page_range_info"
          options={{
            offsetBegin: pageStart,
            offsetEnd: pageEnd,
            total: total === -1 ? pageEnd : total,
          }}
        >
          {total != null
            ? `${pageStart}-${pageEnd} of ${total === -1 ? pageEnd : total}`
            : null}
        </Translate>
      </div>
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="gap-0.5">
          <PaginationItem>
            {hasPreviousPage ? (
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(page - 1)}
                className="size-7"
                aria-label={translate("ra.navigation.previous", {
                  _: "Previous",
                })}
              >
                <ChevronLeftIcon className="size-3.5" />
              </PaginationLink>
            ) : (
              <span className="inline-flex size-7 items-center justify-center">
                <ChevronLeftIcon
                  aria-label={translate("ra.navigation.previous", {
                    _: "Previous",
                  })}
                  className="size-3.5 text-muted-foreground"
                />
              </span>
            )}
          </PaginationItem>
          {startPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
                className="size-7 text-xs"
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          {siblingsStart > boundaryCount + 2 ? (
            <PaginationItem>
              <PaginationEllipsis className="size-7" />
            </PaginationItem>
          ) : boundaryCount + 1 < count - boundaryCount ? (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(boundaryCount + 1)}
                isActive={boundaryCount + 1 === page}
                className="size-7 text-xs"
              >
                {boundaryCount + 1}
              </PaginationLink>
            </PaginationItem>
          ) : null}
          {siblingPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
                className="size-7 text-xs"
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          {siblingsEnd < count - boundaryCount - 1 ? (
            <PaginationItem>
              <PaginationEllipsis className="size-7" />
            </PaginationItem>
          ) : count - boundaryCount > boundaryCount ? (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(count - boundaryCount)}
                isActive={count - boundaryCount === page}
                className="size-7 text-xs"
              >
                {count - boundaryCount}
              </PaginationLink>
            </PaginationItem>
          ) : null}
          {endPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
                className="size-7 text-xs"
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            {hasNextPage ? (
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(page + 1)}
                className="size-7"
                aria-label={translate("ra.navigation.next", { _: "Next" })}
              >
                <ChevronRightIcon className="size-3.5" />
              </PaginationLink>
            ) : (
              <span className="inline-flex size-7 items-center justify-center">
                <ChevronRightIcon
                  aria-label={translate("ra.navigation.next", { _: "Next" })}
                  className="size-3.5 text-muted-foreground"
                />
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
