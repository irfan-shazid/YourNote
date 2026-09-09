"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CommentForm } from "@/components/comments/comment-form";
import { CommentItem, type CommentActions } from "@/components/comments/comment-item";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { Comment } from "@/types/api";

type Viewer = { id: string; name: string; image: string | null; role: string } | null;

/**
 * The discussion under a note. The server renders the first page; every change
 * after that refetches the thread so counts, nesting and moderation state stay
 * exactly what the API says they are.
 */
export function CommentSection({
  noteId,
  noteAuthorId,
  initialComments,
  viewer,
}: {
  noteId: string;
  noteAuthorId: string;
  initialComments: Comment[];
  viewer: Viewer;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = viewer?.role === "admin";
  const total = comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);

  async function refresh() {
    try {
      setComments(await api.comments(noteId));
      router.refresh();
    } catch {
      // A failed refresh leaves the last good thread on screen.
    }
  }

  function reportError(error: unknown, fallback: string) {
    toast.error(error instanceof ApiError ? error.message : fallback);
  }

  const actions: CommentActions = {
    async onReply(parentId, content) {
      try {
        await api.addComment(noteId, content, parentId);
        toast.success("Reply posted.");
        await refresh();
      } catch (error) {
        reportError(error, "Could not post your reply.");
      }
    },

    async onEdit(commentId, content) {
      try {
        await api.editComment(commentId, content);
        toast.success("Comment updated.");
        await refresh();
      } catch (error) {
        reportError(error, "Could not update your comment.");
      }
    },

    onDelete(comment) {
      setDeleting(comment);
      setReason("");
    },

    onReport(comment) {
      setReporting(comment);
      setReason("");
      setDetails("");
    },
  };

  async function confirmDelete() {
    if (!deleting) return;

    setBusy(true);
    try {
      const moderating = isAdmin && deleting.author.id !== viewer?.id;
      if (moderating) {
        await api.admin.removeComment(deleting.id, reason.trim() || undefined);
      } else {
        await api.deleteComment(deleting.id);
      }
      toast.success("Comment removed.");
      setDeleting(null);
      await refresh();
    } catch (error) {
      reportError(error, "Could not remove that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReport() {
    if (!reporting) return;
    if (!reason.trim()) {
      toast.error("Tell us what is wrong with this comment.");
      return;
    }

    setBusy(true);
    try {
      await api.report({
        targetType: "comment",
        targetId: reporting.id,
        reason: reason.trim(),
        details: details.trim() || null,
      });
      toast.success("Thanks - our moderators will take a look.");
      setReporting(null);
    } catch (error) {
      reportError(error, "Could not send that report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="comments" className="space-y-6 scroll-mt-24">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
        <MessageSquare className="size-5 text-primary" />
        Discussion
        {total > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {total}
          </span>
        ) : null}
      </h2>

      {viewer ? (
        <CommentForm
          author={viewer}
          onSubmit={async (content) => {
            try {
              await api.addComment(noteId, content);
              toast.success("Comment posted.");
              await refresh();
            } catch (error) {
              reportError(error, "Could not post your comment.");
            }
          }}
        />
      ) : (
        <div className="surface-card flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-muted-foreground">
            Sign in to join the discussion and react to this note.
          </p>
          <Button asChild size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      )}

      {comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No comments yet"
          description="Be the first to say something useful about this note."
        />
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              actions={actions}
              viewer={viewer}
              isAdmin={Boolean(isAdmin)}
              noteAuthorId={noteAuthorId}
            />
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove this comment?"
        description={
          isAdmin && deleting && deleting.author.id !== viewer?.id
            ? "The comment will be hidden from readers and the removal is written to the audit log."
            : "Your comment will be removed from the discussion."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={busy}>
              Remove comment
            </Button>
          </>
        }
      >
        {isAdmin && deleting && deleting.author.id !== viewer?.id ? (
          <Input
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Spam, harassment, off topic..."
            maxLength={300}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title="Report this comment"
        description="Moderators review every report."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void confirmReport()} loading={busy}>
              Send report
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="What is wrong?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Spam, harassment, misinformation..."
            maxLength={120}
          />
          <Textarea
            label="Anything else? (optional)"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </Dialog>
    </section>
  );
}
