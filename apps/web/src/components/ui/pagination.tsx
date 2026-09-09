"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/api";

/**
 * Compact pager. It reports the page to change to, leaving the caller to decide
 * whether that means a router push or a client-side refetch.
 */
export function Pagination({
  meta,
  onChange,
  className,
}: {
  meta: PaginationMeta;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (meta.totalPages <= 1) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`}>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {from}-{to}
        </span>{" "}
        of {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(meta.page - 1)}
          disabled={meta.page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <span className="px-1 text-sm tabular-nums text-muted-foreground">
          {meta.page} / {meta.totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(meta.page + 1)}
          disabled={!meta.hasMore}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
