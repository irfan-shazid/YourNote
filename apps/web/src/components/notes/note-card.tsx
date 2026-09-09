import { Eye, FileText, ImageIcon, Lock, MessageCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatCount, gradientFor, readingTime, toPlainText, truncate } from "@/lib/utils";
import type { Note } from "@/types/api";

/** Relative time without pulling in a formatting library on the server. */
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];

  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  for (const [size, nextUnit] of steps) {
    if (Math.abs(value) < size) break;
    value = Math.round(value / size);
    unit = nextUnit;
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-value, unit);
}

export function NoteCard({ note, className }: { note: Note; className?: string }) {
  const preview = note.summary ?? truncate(toPlainText(note.content ?? ""), 150);
  const pdfCount = note.attachments.filter((file) => file.format === "pdf").length;
  const imageCount = note.attachments.filter((file) => file.resourceType === "image" && file.format !== "pdf").length;
  const totalReactions = note.stats.reactions;

  return (
    <article
      className={cn(
        "group surface-card hover-lift relative flex h-full flex-col overflow-hidden",
        className,
      )}
    >
      <Link href={`/notes/${note.slug}`} className="absolute inset-0 z-10" aria-label={note.title}>
        <span className="sr-only">{note.title}</span>
      </Link>

      {/* Cover: the uploaded image, or a deterministic gradient so a card
          without one still looks intentional. */}
      <div className="relative h-32 overflow-hidden">
        {note.coverImage ? (
          <Image
            src={note.coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            className={cn(
              "size-full bg-gradient-to-br transition-transform duration-500 group-hover:scale-105",
              gradientFor(note.id),
            )}
          >
            <div className="grid-backdrop size-full opacity-30" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {note.subject ? (
            <Badge className="border border-white/25 bg-black/45 text-white backdrop-blur-sm">
              {note.subject}
            </Badge>
          ) : null}
          {note.status === "draft" ? <Badge tone="warning">Draft</Badge> : null}
          {note.status === "removed" ? <Badge tone="danger">Removed</Badge> : null}
          {note.visibility === "private" ? (
            <Badge className="border border-white/25 bg-black/45 text-white backdrop-blur-sm">
              <Lock className="size-3" />
              Private
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-3">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {note.title}
          </h3>
          {preview ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {preview}
            </p>
          ) : null}
        </div>

        {note.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
            {note.tags.length > 3 ? (
              <span className="text-[11px] text-muted-foreground">
                +{note.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        {pdfCount > 0 || imageCount > 0 ? (
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
            {pdfCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5 text-danger" />
                {pdfCount} PDF{pdfCount > 1 ? "s" : ""}
              </span>
            ) : null}
            {imageCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="size-3.5 text-highlight" />
                {imageCount} image{imageCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <Link
            href={`/u/${note.author.id}`}
            className="relative z-20 flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Avatar name={note.author.name} src={note.author.image} size="xs" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium text-foreground">
                {note.author.name}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {timeAgo(note.createdAt)}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2.5 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={`${totalReactions} reactions`}>
              <Sparkles className="size-3.5" />
              {formatCount(totalReactions)}
            </span>
            <span className="inline-flex items-center gap-1" title={`${note.stats.comments} comments`}>
              <MessageCircle className="size-3.5" />
              {formatCount(note.stats.comments)}
            </span>
            <span className="inline-flex items-center gap-1" title={`${note.stats.views} views`}>
              <Eye className="size-3.5" />
              {formatCount(note.stats.views)}
            </span>
          </div>
        </div>
      </div>

      {note.content ? (
        <span className="sr-only">{readingTime(note.content)}</span>
      ) : null}
    </article>
  );
}
