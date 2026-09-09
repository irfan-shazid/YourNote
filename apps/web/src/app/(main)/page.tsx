import {
  ArrowRight,
  FileText,
  MessageCircle,
  Search,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { NoteGrid } from "@/components/notes/note-grid";
import { Button } from "@/components/ui/button";
import { NoteCardSkeleton } from "@/components/ui/skeleton";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Upload,
    title: "Bring your files",
    description:
      "Attach lecture PDFs, scanned pages and diagrams. They upload straight to Cloudinary and preview inline.",
  },
  {
    icon: Sparkles,
    title: "React, not just like",
    description:
      "Six reactions let readers say what a note actually was: helpful, insightful, or plain brilliant.",
  },
  {
    icon: MessageCircle,
    title: "Discuss in threads",
    description:
      "Ask a question under any note and get a reply from the author or anyone who understood it first.",
  },
  {
    icon: Search,
    title: "Find it again",
    description:
      "Search across titles, tags, subjects and full note bodies. Save the good ones to your library.",
  },
];

/** Newest and most-loved notes, streamed in so the hero paints immediately. */
async function FeaturedNotes() {
  const [latest, popular] = await Promise.all([
    serverApi.notes({ pageSize: 6, sort: "recent" }),
    serverApi.notes({ pageSize: 3, sort: "popular" }),
  ]);

  if (latest.meta.total === 0) {
    return (
      <NoteGrid
        notes={[]}
        emptyTitle="No notes have been published yet"
        emptyDescription="Be the first to share something worth reading."
        emptyAction={
          <Button asChild>
            <Link href="/notes/new">Write the first note</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-16">
      {popular.items.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Most loved this week
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The notes people keep coming back to.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/notes?sort=popular">
                See all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <NoteGrid notes={popular.items} />
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Fresh notes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(latest.meta.total)} note{latest.meta.total === 1 ? "" : "s"} published
              so far.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/notes">
              Browse all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <NoteGrid notes={latest.items} />
      </section>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="relative">
      <div className="aurora" />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-backdrop absolute inset-0 -z-10" />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24 lg:px-8">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="flex size-1.5 rounded-full bg-success" />
            Share notes. Get reactions. Actually discuss them.
          </div>

          <h1
            className="animate-fade-up mx-auto mt-6 max-w-4xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-6xl"
            style={{ animationDelay: "0.05s" }}
          >
            The notes you took are
            <br className="hidden sm:block" />{" "}
            <span className="gradient-text">worth sharing</span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: "0.1s" }}
          >
            Publish your write-ups with the PDFs and diagrams attached. Let
            people react to what helped, ask questions in the comments, and save
            what they want to come back to.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "0.15s" }}
          >
            <Button asChild size="lg">
              <Link href={user ? "/notes/new" : "/sign-up"}>
                {user ? "Write a note" : "Start sharing free"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/notes">Browse notes</Link>
            </Button>
          </div>

          <div
            className="animate-fade-up mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
            style={{ animationDelay: "0.2s" }}
          >
            <span className="inline-flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              PDF and image attachments
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-4 text-accent" />
              Google or email sign-in
            </span>
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="size-4 text-highlight" />
              Threaded discussion
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="surface-card hover-lift p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                <feature.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Suspense fallback={<FeaturedSkeleton />}>
          <FeaturedNotes />
        </Suspense>
      </section>

      {/* Closing call to action */}
      {!user ? (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-accent/8 to-highlight/12 px-6 py-14 text-center">
            <div className="grid-backdrop absolute inset-0 opacity-40" />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Your notes helped you. They will help someone else.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Create an account with your email or Google and publish your
                first note in a couple of minutes.
              </p>
              <Button asChild size="lg" className="mt-7">
                <Link href="/sign-up">
                  Create your account
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
