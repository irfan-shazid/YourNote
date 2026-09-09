"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import type { TagCount } from "@/types/api";

const sortOptions = [
  { value: "recent", label: "Newest" },
  { value: "popular", label: "Most reactions" },
  { value: "discussed", label: "Most discussed" },
  { value: "views", label: "Most read" },
];

/**
 * Browse filters. Everything lives in the URL, so a filtered view is
 * shareable, bookmarkable and survives a refresh.
 */
export function NoteFilters({
  tags,
  subjects,
}: {
  tags: TagCount[];
  subjects: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const activeTag = params.get("tag") ?? "";
  const activeSubject = params.get("subject") ?? "";
  const activeSort = params.get("sort") ?? "recent";
  const hasFilters = Boolean(activeTag || activeSubject || params.get("search"));

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change resets to the first page.
    next.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const current = params.get("search") ?? "";
    if (search === current) return;

    const timer = window.setTimeout(() => apply({ search: search.trim() || null }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes, topics, authors..."
            aria-label="Search notes"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-10 pl-10 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/12"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activeSort}
            onChange={(event) => apply({ sort: event.target.value })}
            aria-label="Sort notes"
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/12"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className={cn(
              "flex h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
              showFilters || hasFilters
                ? "border-primary/45 bg-primary/8 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {hasFilters ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {[activeTag, activeSubject].filter(Boolean).length + (params.get("search") ? 1 : 0)}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="surface-card animate-fade-in space-y-4 p-4">
          {subjects.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Subject
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((subject) => {
                  const active = activeSubject.toLowerCase() === subject.toLowerCase();
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => apply({ subject: active ? null : subject })}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground",
                      )}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = activeTag === tag.tag;
                  return (
                    <button
                      key={tag.tag}
                      type="button"
                      onClick={() => apply({ tag: active ? null : tag.tag })}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground",
                      )}
                    >
                      #{tag.tag}
                      <span className="ml-1 opacity-60 tabular-nums">{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                apply({ tag: null, subject: null, search: null });
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
