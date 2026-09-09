import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";

import { NoteCard } from "@/components/notes/note-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Note } from "@/types/api";

export function NoteGrid({
  notes,
  emptyTitle = "No notes yet",
  emptyDescription,
  emptyAction,
}: {
  notes: Note[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<FileQuestion className="size-6" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
