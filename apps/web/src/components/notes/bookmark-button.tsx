"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  noteId,
  bookmarked,
  signedIn,
  className,
}: {
  noteId: string;
  bookmarked: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(bookmarked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      toast.info("Sign in to save notes for later.");
      router.push("/sign-in");
      return;
    }
    if (busy) return;

    setBusy(true);
    const previous = saved;
    setSaved(!previous);

    try {
      const result = await api.toggleBookmark(noteId);
      setSaved(result.bookmarked);
      toast.success(result.bookmarked ? "Saved to your library" : "Removed from saved");
      router.refresh();
    } catch (error) {
      setSaved(previous);
      toast.error(error instanceof ApiError ? error.message : "Could not update your saved notes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="sm"
      onClick={() => void toggle()}
      aria-pressed={saved}
      className={cn(saved && "border-primary/40 text-primary", className)}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
