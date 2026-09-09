"use client";

import { MessageSquare, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
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
import type { AdminComment, Paginated, PaginationMeta } from "@/types/api";

type Pending =
  | { kind: "remove"; comment: AdminComment }
  | { kind: "purge"; comment: AdminComment };

const statusOptions = [
  { value: "", label: "All comments" },
  { value: "visible", label: "Visible" },
  { value: "removed", label: "Removed" },
];

/**
 * The comment moderation queue. An admin removes a comment here; removal is a
 * soft delete, so the thread keeps its shape and the action can be undone.
 */
export function CommentsTable({ initial }: { initial: Paginated<AdminComment> }) {
  const [comments, setComments] = useState(initial.items);
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
      const result = await api.admin.comments({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
      });
      setComments(result.items);
      setMeta(result.meta);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function restore(comment: AdminComment) {
    try {
      await api.admin.restoreComment(comment.id);
      toast.success("Comment restored.");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not restore that comment.");
    }
  }

  async function applyAction() {
    if (!pending) return;

    setBusy(true);
    try {
      if (pending.kind === "remove") {
        await api.admin.removeComment(pending.comment.id, reason.trim() || undefined);
        toast.success("Comment removed from the discussion.");
      } else {
        await api.admin.purgeComment(pending.comment.id, reason.trim() || undefined);
        toast.success("Comment deleted permanently.");
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
            placeholder="Search comments, authors or notes..."
            aria-label="Search comments"
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="Nothing to moderate"
          description="No comments match those filters."
        />
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={comment.author.name} src={comment.author.image} size="sm" />
                  <div className="min-w-0">
                    <Link
                      href={`/u/${comment.author.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {comment.author.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {comment.isDeleted ? (
                    <Badge tone="danger">Removed</Badge>
                  ) : (
                    <Badge tone="success">Visible</Badge>
                  )}
                  {comment.parentId ? <Badge>Reply</Badge> : null}
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                {comment.content || <span className="italic text-muted-foreground">Empty</span>}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <Link
                  href={`/notes/${comment.noteSlug}#comments`}
                  className="min-w-0 truncate text-xs text-muted-foreground hover:text-primary"
                >
                  on &ldquo;{comment.noteTitle}&rdquo;
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  {comment.isDeleted ? (
                    <Button variant="outline" size="sm" onClick={() => void restore(comment)}>
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReason("");
                        setPending({ kind: "remove", comment });
                      }}
                    >
                      <XCircle className="size-3.5" />
                      Remove
                    </Button>
                  )}

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setReason("");
                      setPending({ kind: "purge", comment });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination meta={meta} onChange={setPage} />

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending?.kind === "purge" ? "Delete this comment for good?" : "Remove this comment?"}
        description={
          pending?.kind === "purge"
            ? "The comment and its replies are erased. This cannot be undone."
            : "Readers will see a placeholder instead of the text. You can restore it later."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void applyAction()} loading={busy}>
              {pending?.kind === "purge" ? "Delete permanently" : "Remove comment"}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-muted p-3 text-sm break-words">{pending.comment.content}</p>
            <Input
              label="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Spam, harassment, off topic..."
              maxLength={300}
              hint="Recorded in the audit log."
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
