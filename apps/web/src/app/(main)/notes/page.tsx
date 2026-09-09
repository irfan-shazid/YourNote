import type { Metadata } from "next";
import Link from "next/link";

import { NoteFilters } from "@/components/notes/note-filters";
import { NoteGrid } from "@/components/notes/note-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse notes",
  description: "Search and filter every note shared on YourNote.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? 1) || 1;

  const [{ items, meta }, tags, subjects, user] = await Promise.all([
    serverApi.notes({
      page,
      pageSize: 12,
      search: first(params.search),
      tag: first(params.tag),
      subject: first(params.subject),
      sort: first(params.sort),
    }),
    serverApi.tags(),
    serverApi.subjects(),
    getCurrentUser(),
  ]);

  // Pagination is rendered as links so the whole page stays server-rendered.
  const buildPageLink = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const single = first(value);
      if (single && key !== "page") next.set(key, single);
    }
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `/notes?${query}` : "/notes";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library"
        title="Browse notes"
        description={`${meta.total} note${meta.total === 1 ? "" : "s"} shared by the community.`}
        action={
          user ? (
            <Button asChild>
              <Link href="/notes/new">Write a note</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/sign-up">Join to publish</Link>
            </Button>
          )
        }
      />

      <NoteFilters tags={tags} subjects={subjects} />

      <NoteGrid
        notes={items}
        emptyTitle="No notes match those filters"
        emptyDescription="Try a different search term, or clear the filters to see everything."
      />

      {meta.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-4 border-t border-border pt-6">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={meta.page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            <Link href={buildPageLink(meta.page - 1)} aria-disabled={meta.page <= 1}>
              Previous
            </Link>
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            Page {meta.page} of {meta.totalPages}
          </span>

          <Button
            asChild
            variant="outline"
            size="sm"
            className={!meta.hasMore ? "pointer-events-none opacity-50" : undefined}
          >
            <Link href={buildPageLink(meta.page + 1)} aria-disabled={!meta.hasMore}>
              Next
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
