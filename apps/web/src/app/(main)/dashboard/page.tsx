import { Eye, FileText, MessageCircle, PenLine, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { NoteGrid } from "@/components/notes/note-grid";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My notes",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;

  const { items, meta } = await serverApi.myNotes({ pageSize: 24, status });

  const totals = items.reduce(
    (sum, note) => ({
      views: sum.views + note.stats.views,
      reactions: sum.reactions + note.stats.reactions,
      comments: sum.comments + note.stats.comments,
    }),
    { views: 0, reactions: 0, comments: 0 },
  );

  const stats = [
    { label: "Notes", value: meta.total, icon: FileText },
    { label: "Views", value: totals.views, icon: Eye },
    { label: "Reactions", value: totals.reactions, icon: Sparkles },
    { label: "Comments", value: totals.comments, icon: MessageCircle },
  ];

  const filters = [
    { label: "All", value: undefined },
    { label: "Published", value: "published" },
    { label: "Drafts", value: "draft" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`Your notes, ${user.name.split(" ")[0]}`}
        description="Everything you have written, including drafts only you can see."
        action={
          <Button asChild>
            <Link href="/notes/new">
              <PenLine className="size-4" />
              Write a note
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {stat.label}
              </p>
              <stat.icon className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {formatCount(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = status === filter.value;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/dashboard?status=${filter.value}` : "/dashboard"}
              className={
                active
                  ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <NoteGrid
        notes={items}
        emptyTitle="Nothing here yet"
        emptyDescription="Publish your first note and it will show up here with its stats."
        emptyAction={
          <Button asChild>
            <Link href="/notes/new">Write your first note</Link>
          </Button>
        }
      />
    </div>
  );
}
