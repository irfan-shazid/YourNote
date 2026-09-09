"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { commentSchema } from "@/lib/validators/note";

const MAX = 2000;

export function CommentForm({
  onSubmit,
  author,
  placeholder = "Share what you think...",
  submitLabel = "Post comment",
  initialValue = "",
  autoFocus = false,
  onCancel,
  compact = false,
}: {
  onSubmit: (content: string) => Promise<void>;
  author?: { name: string; image: string | null } | null;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [content, setContent] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const parsed = commentSchema.safeParse({ content });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    setBusy(true);
    try {
      await onSubmit(parsed.data.content);
      setContent("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {author && !compact ? (
        <Avatar name={author.name} src={author.image} size="sm" className="mt-1" />
      ) : null}

      <div className="min-w-0 flex-1 space-y-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          error={error}
          counter={content.length > MAX * 0.75 ? { value: content.length, max: MAX } : undefined}
          autoFocus={autoFocus}
          disabled={busy}
          // Submitting with the keyboard keeps a fast reply flow.
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        />

        <div className="flex items-center justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          ) : null}

          <Button type="submit" size="sm" loading={busy} disabled={!content.trim()}>
            <Send className="size-3.5" />
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
