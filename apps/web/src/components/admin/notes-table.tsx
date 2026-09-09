"use client";

import { Eye, FileText, MessageSquare, RotateCcw, Search, ShieldOff, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { formatCount } from "@/lib/utils";
import type { Note, Paginated, PaginationMeta } from "@/types/api";

type Pending = { kind: "remove" | "restore" | "delete"; note: Note };

const statusOptions = [
  { value: "", label: "All notes" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "removed", label: "Removed" },
];

export function NotesTable({ initial }: { initial: Paginated<Note> }) {
  const [notes, setNotes] = useState(initial.items);
  const [meta, setMeta] = useState<PaginationMeta>(initial.meta);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.notes({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
      });
      setNotes(result.items);
      setMeta(result.meta);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not load notes.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function applyAction() {
    if (!pending) return;

    setBusy(true);
    try {
      if (pending.kind === "delete") {
        await api.admin.deleteNote(pending.note.id);
        toast.success("Note deleted, and its files were removed from Cloudinary.");
      } else {
        const next = pending.kind === "remove" ? "removed" : "published";
        await api.admin.setNoteStatus(pending.note.id, next, reason.trim() || undefined);
        toast.success(next === "removed" ? "Note hidden from readers." : "Note restored.");
      }

      setPending(null);
      setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not apply that change.");
    } finally {
      setBusy(false);
    }
  }

  const copy = {
    remove: {
      title: "Remove this note?",
      description: "It disappears from browse and search. The author keeps their copy.",
      confirm: "Remove note",
    },
    restore: {
      title: "Restore this note?",
      description: "It becomes visible to readers again.",
      confirm: "Restore note",
    },
    delete: {
      title: "Delete this note for good?",
      description:
        "The note, its attachments, comments and reactions are erased. This cannot be undone.",
      confirm: "Delete permanently",
    },
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search notes, tags or authors..."
            aria-label="Search notes"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/12"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={statusOptions}
          aria-label="Filter by status"
          className="w-44"
        />
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No notes match those filters"
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="p-4 font-medium">Note</th>
                  <th className="p-4 font-medium">Author</th>
                  <th className="p-4 font-medium">State</th>
                  <th className="p-4 text-right font-medium">Engagement</th>
                  <th className="p-4 font-medium">Published</th>
                  <th className="p-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {notes.map((note) => (
                  <tr key={note.id} className="transition-colors hover:bg-muted/40">
                    <td className="max-w-sm p-4">
                      <Link
                        href={`/notes/${note.slug}`}
                        className="line-clamp-1 font-medium text-foreground hover:text-primary"
                      >
                        {note.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {note.tags.length > 0 ? note.tags.map((t) => `#${t}`).join(" ") : "No tags"}
                      </p>
                    </td>

                    <td className="p-4">
                      <Link href={`/u/${note.author.id}`} className="flex items-center gap-2">
                        <Avatar name={note.author.name} src={note.author.image} size="xs" />
                        <span className="truncate text-xs">{note.author.name}</span>
                      </Link>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {note.status === "removed" ? (
                          <Badge tone="danger">Removed</Badge>
                        ) : note.status === "draft" ? (
                          <Badge tone="warning">Draft</Badge>
                        ) : (
                          <Badge tone="success">Published</Badge>
                        )}
                        {note.visibility !== "public" ? (
                          <Badge className="capitalize">{note.visibility}</Badge>
                        ) : null}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="size-3.5" />
                          {formatCount(note.stats.reactions)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          {formatCount(note.stats.comments)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" />
                          {formatCount(note.stats.views)}
                        </span>
                      </div>
                    </td>

                    <td className="p-4 text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-1.5">
                        {note.status === "removed" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPending({ kind: "restore", note })}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Remove note"
                            onClick={() => {
                              setReason("");
                              setPending({ kind: "remove", note });
                            }}
                          >
                            <ShieldOff className="size-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="danger"
                          size="sm"
                          aria-label="Delete note"
                          onClick={() => setPending({ kind: "delete", note })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination meta={meta} onChange={setPage} />

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? copy[pending.kind].title : ""}
        description={pending ? copy[pending.kind].description : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={pending?.kind === "restore" ? "primary" : "danger"}
              onClick={() => void applyAction()}
              loading={busy}
            >
              {pending ? copy[pending.kind].confirm : ""}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-muted p-3 text-sm font-medium">{pending.note.title}</p>
            {pending.kind === "remove" ? (
              <Input
                label="Reason (optional)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Plagiarism, spam, wrong information..."
                maxLength={300}
                hint="Recorded in the audit log."
              />
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
