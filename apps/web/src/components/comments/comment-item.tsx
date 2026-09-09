"use client";

import { Flag, MoreHorizontal, Pencil, Reply, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CommentForm } from "@/components/comments/comment-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/api";

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type CommentActions = {
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (comment: Comment) => void;
  onReport: (comment: Comment) => void;
};

export function CommentItem({
  comment,
  actions,
  viewer,
  isAdmin,
  noteAuthorId,
  depth = 0,
}: {
  comment: Comment;
  actions: CommentActions;
  viewer: { id: string; name: string; image: string | null } | null;
  isAdmin: boolean;
  noteAuthorId: string;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);

  const removed = comment.isDeleted;
  const isNoteAuthor = comment.author.id === noteAuthorId;

  return (
    <div className={cn("animate-fade-in", depth > 0 && "ml-5 border-l border-border pl-4 sm:ml-8")}>
      <div className="flex gap-3">
        <Link href={`/u/${comment.author.id}`} className="mt-0.5 shrink-0">
          <Avatar name={comment.author.name} src={comment.author.image} size="sm" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/u/${comment.author.id}`}
              className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {comment.author.name}
            </Link>

            {isNoteAuthor ? (
              <Badge tone="primary" className="px-1.5 py-0 text-[10px]">
                Author
              </Badge>
            ) : null}
            {comment.author.role === "admin" ? (
              <Badge tone="default" className="px-1.5 py-0 text-[10px]">
                <Shield className="size-2.5" />
                Admin
              </Badge>
            ) : null}

            <span className="text-xs text-muted-foreground">{relativeTime(comment.createdAt)}</span>
            {comment.updatedAt !== comment.createdAt && !removed ? (
              <span className="text-xs text-muted-foreground">(edited)</span>
            ) : null}
          </div>

          {removed ? (
            <p className="mt-1.5 text-sm text-muted-foreground italic">
              This comment was removed by a moderator.
              {isAdmin && comment.content ? (
                <span className="mt-1 block rounded-lg border border-dashed border-border bg-muted/50 p-2 text-xs not-italic">
                  Original: {comment.content}
                </span>
              ) : null}
            </p>
          ) : editing ? (
            <div className="mt-2">
              <CommentForm
                compact
                initialValue={comment.content}
                submitLabel="Save"
                autoFocus
                onCancel={() => setEditing(false)}
                onSubmit={async (content) => {
                  await actions.onEdit(comment.id, content);
                  setEditing(false);
                }}
              />
            </div>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {comment.content}
            </p>
          )}

          {!removed && !editing ? (
            <div className="mt-2 flex items-center gap-1">
              {viewer && depth === 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setReplying((value) => !value)}
                >
                  <Reply className="size-3.5" />
                  Reply
                </Button>
              ) : null}

              {viewer ? (
                <Dropdown
                  align="start"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label="Comment actions"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      {comment.canEdit ? (
                        <DropdownItem
                          onClick={() => {
                            close();
                            setEditing(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownItem>
                      ) : null}

                      {comment.author.id !== viewer.id ? (
                        <DropdownItem
                          onClick={() => {
                            close();
                            actions.onReport(comment);
                          }}
                        >
                          <Flag className="size-4" />
                          Report
                        </DropdownItem>
                      ) : null}

                      {comment.canDelete ? (
                        <DropdownItem
                          tone="danger"
                          onClick={() => {
                            close();
                            actions.onDelete(comment);
                          }}
                        >
                          <Trash2 className="size-4" />
                          {comment.author.id === viewer.id ? "Delete" : "Remove as admin"}
                        </DropdownItem>
                      ) : null}
                    </>
                  )}
                </Dropdown>
              ) : null}
            </div>
          ) : null}

          {replying && viewer ? (
            <div className="mt-3">
              <CommentForm
                compact
                autoFocus
                submitLabel="Reply"
                placeholder={`Replying to ${comment.author.name}...`}
                onCancel={() => setReplying(false)}
                onSubmit={async (content) => {
                  await actions.onReply(comment.id, content);
                  setReplying(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              actions={actions}
              viewer={viewer}
              isAdmin={isAdmin}
              noteAuthorId={noteAuthorId}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
