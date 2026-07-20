"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { getPaginationWindow } from "../lib/patterns";
import { cn } from "../lib/utils";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "./pagination";

export type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  summary?: string;
  className?: string;
  previousLabel?: string;
  nextLabel?: string;
};

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  summary,
  className,
  previousLabel = "Go to the previous page",
  nextLabel = "Go to the next page",
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, Math.trunc(totalPages));
  const safePage = Math.min(Math.max(Math.trunc(page), 1), safeTotalPages);
  const items = getPaginationWindow(safePage, safeTotalPages);

  const changePage = (nextPage: number) => {
    const clampedPage = Math.min(Math.max(nextPage, 1), safeTotalPages);
    if (clampedPage !== safePage) onPageChange(clampedPage);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2 border-t border-hairline px-4 py-2 md:flex-row md:items-center md:justify-between", className)}>
      {summary ? (
        <p className="min-w-0 truncate text-ui-meta">
          <span className="font-semibold text-foreground">Page {safePage} of {safeTotalPages}</span>
          <span className="px-1.5 text-border">·</span>
          {summary}
        </p>
      ) : null}
      <Pagination className="mx-0 w-auto min-w-0 shrink-0 justify-start md:ml-auto md:justify-end">
        <PaginationContent className="gap-1.5">
          <PaginationItem>
            <PaginationLink
              size="sm"
              href="#"
              aria-label={previousLabel}
              aria-disabled={safePage === 1}
              onClick={(event) => {
                event.preventDefault();
                changePage(safePage - 1);
              }}
              className={cn("size-8 rounded-full border border-transparent text-muted-foreground hover:border-hairline-strong hover:bg-surface-hover hover:text-foreground", safePage === 1 && "pointer-events-none opacity-45")}
            >
              <ChevronLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          {items.map((item) => typeof item === "number" ? (
            <PaginationItem key={item}>
              <PaginationLink
                size="sm"
                href="#"
                isActive={item === safePage}
                onClick={(event) => {
                  event.preventDefault();
                  changePage(item);
                }}
                className={cn(
                  "size-8 rounded-full text-ui-label normal-case tracking-normal",
                  item === safePage ? "border-hairline-strong bg-elevate-2 text-foreground" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationEllipsis />
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationLink
              size="sm"
              href="#"
              aria-label={nextLabel}
              aria-disabled={safePage === safeTotalPages}
              onClick={(event) => {
                event.preventDefault();
                changePage(safePage + 1);
              }}
              className={cn("size-8 rounded-full border border-transparent text-muted-foreground hover:border-hairline-strong hover:bg-surface-hover hover:text-foreground", safePage === safeTotalPages && "pointer-events-none opacity-45")}
            >
              <ChevronRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
