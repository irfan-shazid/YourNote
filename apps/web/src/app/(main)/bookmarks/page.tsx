import { BookMarked } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { NoteGrid } from "@/components/notes/note-grid";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved notes",
};

export default async function BookmarksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/bookmarks");

  const { items, meta } = await serverApi.myBookmarks({ pageSize: 24 });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library"
        title="Saved notes"
        description={`${meta.total} note${meta.total === 1 ? "" : "s"} you kept for later.`}
      />

      <NoteGrid
        notes={items}
        emptyTitle="No saved notes yet"
        emptyDescription="Tap Save on any note and it will wait for you here."
        emptyAction={
          <Button asChild>
            <Link href="/notes">
              <BookMarked className="size-4" />
              Find something to read
            </Link>
          </Button>
        }
      />
    </div>
  );
}
