import { Calendar, Eye, Globe, Link2Off, Lock, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentSection } from "@/components/comments/comment-section";
import { AttachmentList } from "@/components/notes/attachment-list";
import { BookmarkButton } from "@/components/notes/bookmark-button";
import { Markdown } from "@/components/notes/markdown";
import { NoteActions } from "@/components/notes/note-actions";
import { NoteCard } from "@/components/notes/note-card";
import { ReactionBar } from "@/components/notes/reaction-bar";
import { ViewTracker } from "@/components/notes/view-tracker";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";
import { formatCount, readingTime, toPlainText, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const note = await serverApi.note(slug);

  if (!note) return { title: "Note not found" };

  const description =
    note.summary ?? truncate(toPlainText(note.content ?? ""), 155) ?? "A note shared on YourNote.";

  return {
    title: note.title,
    description,
    openGraph: {
      title: note.title,
      description,
      type: "article",
      publishedTime: note.createdAt,
      authors: [note.author.name],
      ...(note.coverImage ? { images: [{ url: note.coverImage }] } : {}),
    },
    // Unlisted and private notes must never be indexed.
    robots: note.visibility === "public" ? undefined : { index: false, follow: false },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;

  const [note, user] = await Promise.all([serverApi.note(slug), getCurrentUser()]);
  if (!note) notFound();

  const [comments, related] = await Promise.all([
    serverApi.comments(note.id),
    serverApi.notes({
      pageSize: 3,
      tag: note.tags[0],
      sort: "popular",
    }),
  ]);

  const publishedAt = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const otherNotes = related.items.filter((item) => item.id !== note.id).slice(0, 3);
  const isAdmin = user?.role === "admin";

  return (
    <>
      <ViewTracker noteId={note.id} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Status banners */}
        {note.status === "removed" ? (
          <div className="mb-6 rounded-xl border border-danger/30 bg-danger/8 p-4 text-sm text-danger">
            This note was removed by a moderator. Only admins can see it.
          </div>
        ) : null}
        {note.status === "draft" ? (
          <div className="mb-6 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm text-warning">
            This is a draft. Only you can see it until you publish it.
          </div>
        ) : null}

        <header className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {note.subject ? <Badge tone="primary">{note.subject}</Badge> : null}
            {note.visibility === "private" ? (
              <Badge tone="warning">
                <Lock className="size-3" />
                Private
              </Badge>
            ) : note.visibility === "unlisted" ? (
              <Badge>
                <Link2Off className="size-3" />
                Unlisted
              </Badge>
            ) : (
              <Badge>
                <Globe className="size-3" />
                Public
              </Badge>
            )}
          </div>

          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {note.title}
          </h1>

          {note.summary ? (
            <p className="text-lg leading-relaxed text-muted-foreground">{note.summary}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
            <Link
              href={`/u/${note.author.id}`}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <Avatar
                name={note.author.name}
                src={note.author.image}
                size="md"
                ring={note.author.role === "admin"}
              />
              <div>
                <p className="text-sm font-semibold text-foreground">{note.author.name}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {publishedAt}
                  </span>
                  <span>{readingTime(note.content ?? "")}</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" />
                    {formatCount(note.stats.views)}
                  </span>
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <BookmarkButton
                noteId={note.id}
                bookmarked={note.viewer.bookmarked}
                signedIn={Boolean(user)}
              />
              <NoteActions note={note} signedIn={Boolean(user)} isAdmin={Boolean(isAdmin)} />
            </div>
          </div>
        </header>

        {note.coverImage ? (
          <div className="relative mt-8 aspect-21/9 overflow-hidden rounded-2xl border border-border">
            <Image
              src={note.coverImage}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        ) : null}

        <div className="mt-8">
          <Markdown content={note.content ?? ""} />
        </div>

        {note.tags.length > 0 ? (
          <div className="mt-10 flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <Link
                key={tag}
                href={`/notes?tag=${encodeURIComponent(tag)}`}
                className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary"
              >
                #{tag}
              </Link>
            ))}
          </div>
        ) : null}

        {note.attachments.length > 0 ? (
          <div className="mt-10">
            <AttachmentList attachments={note.attachments} />
          </div>
        ) : null}

        {/* Reactions */}
        <div className="surface-card mt-10 space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Was this note useful?</p>
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatCount(note.stats.reactions)} reactions</span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {formatCount(note.stats.comments)}
              </span>
            </p>
          </div>

          <ReactionBar
            noteId={note.id}
            stats={note.stats}
            viewerReactions={note.viewer.reactions}
            signedIn={Boolean(user)}
          />
        </div>

        <div className="mt-14">
          <CommentSection
            noteId={note.id}
            noteAuthorId={note.author.id}
            initialComments={comments}
            viewer={
              user
                ? { id: user.id, name: user.name, image: user.image ?? null, role: user.role ?? "user" }
                : null
            }
          />
        </div>
      </article>

      {otherNotes.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="mb-5 text-lg font-semibold tracking-tight">More like this</h2>
          <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {otherNotes.map((item) => (
              <NoteCard key={item.id} note={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
