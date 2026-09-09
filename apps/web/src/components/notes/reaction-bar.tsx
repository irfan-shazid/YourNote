"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { cn, formatCount } from "@/lib/utils";
import { REACTION_TYPES, type NoteStats, type ReactionType } from "@/types/api";

const reactionMeta: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: "\u{1F44D}", label: "Helpful" },
  love: { emoji: "\u{2764}\u{FE0F}", label: "Love it" },
  fire: { emoji: "\u{1F525}", label: "Fire" },
  insightful: { emoji: "\u{1F4A1}", label: "Insightful" },
  clap: { emoji: "\u{1F44F}", label: "Well done" },
  wow: { emoji: "\u{1F929}", label: "Wow" },
};

export function ReactionBar({
  noteId,
  stats,
  viewerReactions,
  signedIn,
  size = "md",
}: {
  noteId: string;
  stats: NoteStats;
  viewerReactions: ReactionType[];
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [counts, setCounts] = useState(stats.reactionCounts);
  const [mine, setMine] = useState<ReactionType[]>(viewerReactions);
  const [pending, setPending] = useState<ReactionType | null>(null);

  async function toggle(type: ReactionType) {
    if (!signedIn) {
      toast.info("Sign in to react to this note.");
      router.push("/sign-in");
      return;
    }
    if (pending) return;

    // Optimistic update, reconciled with the server response below.
    const wasActive = mine.includes(type);
    setPending(type);
    setMine((current) => (wasActive ? current.filter((t) => t !== type) : [...current, type]));
    setCounts((current) => ({
      ...current,
      [type]: Math.max(0, (current[type] ?? 0) + (wasActive ? -1 : 1)),
    }));

    try {
      const result = await api.react(noteId, type);
      setCounts(result.reactionCounts);
      setMine(result.viewerReactions);
      startTransition(() => router.refresh());
    } catch (error) {
      // Roll the optimistic change back so the UI never lies about state.
      setMine((current) => (wasActive ? [...current, type] : current.filter((t) => t !== type)));
      setCounts((current) => ({
        ...current,
        [type]: Math.max(0, (current[type] ?? 0) + (wasActive ? 1 : -1)),
      }));
      toast.error(error instanceof ApiError ? error.message : "Could not save your reaction.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_TYPES.map((type) => {
        const count = counts[type] ?? 0;
        const active = mine.includes(type);
        const meta = reactionMeta[type];

        return (
          <button
            key={type}
            type="button"
            onClick={() => void toggle(type)}
            title={meta.label}
            aria-pressed={active}
            aria-label={`${meta.label}${count ? `, ${count}` : ""}`}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border transition-all duration-200",
              "active:scale-95",
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active
                ? "border-primary/45 bg-primary/12 text-primary"
                : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-muted",
              pending === type && "opacity-60",
            )}
          >
            <span
              className={cn(
                "leading-none transition-transform group-hover:scale-115",
                active && "animate-pop",
              )}
              aria-hidden
            >
              {meta.emoji}
            </span>
            {count > 0 ? (
              <span className="font-medium tabular-nums">{formatCount(count)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
