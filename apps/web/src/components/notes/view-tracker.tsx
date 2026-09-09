"use client";

import { useEffect, useRef } from "react";

import { api } from "@/lib/api/client";

/**
 * Records one view per reader. The Go API de-duplicates by user id, or by a
 * hash of address and user agent for signed-out readers, so a refresh never
 * inflates the counter.
 */
export function ViewTracker({ noteId }: { noteId: string }) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    // A failed view ping is not worth surfacing to the reader.
    const timer = window.setTimeout(() => {
      void api.registerView(noteId).catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [noteId]);

  return null;
}
