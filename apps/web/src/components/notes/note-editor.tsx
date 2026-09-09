"use client";

import { Eye, Loader2, Pencil, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/notes/markdown";
import { AttachmentUploader } from "@/components/notes/attachment-uploader";
import { TagInput } from "@/components/notes/tag-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { cn, readingTime } from "@/lib/utils";
import { noteSchema } from "@/lib/validators/note";
import type { AttachmentInput, Note, NoteInput, Visibility } from "@/types/api";

type Errors = Partial<Record<string, string>>;

const visibilityOptions = [
  { value: "public", label: "Public - anyone can find it" },
  { value: "unlisted", label: "Unlisted - only people with the link" },
  { value: "private", label: "Private - only you" },
];

export function NoteEditor({
  note,
  suggestedTags = [],
}: {
  note?: Note;
  suggestedTags?: string[];
}) {
  const router = useRouter();
  const editing = Boolean(note);

  const [title, setTitle] = useState(note?.title ?? "");
  const [summary, setSummary] = useState(note?.summary ?? "");
  const [subject, setSubject] = useState(note?.subject ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [visibility, setVisibility] = useState<Visibility>(note?.visibility ?? "public");
  const [attachments, setAttachments] = useState<AttachmentInput[]>(
    note?.attachments.map((file) => ({
      url: file.url,
      secureUrl: file.secureUrl,
      publicId: file.publicId,
      resourceType: file.resourceType,
      format: file.format,
      originalName: file.originalName,
      bytes: file.bytes,
      width: file.width,
      height: file.height,
      pages: file.pages,
    })) ?? [],
  );

  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);

  // The first uploaded image doubles as the cover, so authors get a good card
  // without a separate upload step.
  const coverImage = useMemo(() => {
    const firstImage = attachments.find(
      (file) => file.resourceType === "image" && file.format !== "pdf",
    );
    return note?.coverImage ?? firstImage?.secureUrl ?? null;
  }, [attachments, note?.coverImage]);

  function buildPayload(status: "draft" | "published"): NoteInput {
    return {
      title: title.trim(),
      summary: summary.trim() || null,
      content: content.trim(),
      subject: subject.trim() || null,
      tags,
      coverImage,
      visibility,
      status,
      attachments,
    };
  }

  async function submit(status: "draft" | "published") {
    const parsed = noteSchema.safeParse({
      title,
      summary: summary.trim() || undefined,
      content,
      subject: subject.trim() || undefined,
      tags,
      visibility,
      status,
    });

    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setErrors({});
    setSaving(status);

    try {
      const payload = buildPayload(status);
      const saved = editing
        ? await api.updateNote(note!.id, payload)
        : await api.createNote(payload);

      toast.success(
        status === "draft"
          ? "Draft saved."
          : editing
            ? "Note updated."
            : "Note published.",
      );
      router.push(`/notes/${saved.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        // The API returns per-field messages; surface them on the same fields.
        if (error.isValidation) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Could not save this note.");
      }
    } finally {
      setSaving(null);
    }
  }

  const busy = saving !== null;

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit("published");
      }}
    >
      <div className="space-y-5">
        <Input
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Fourier transforms, explained simply"
          error={errors.title}
          maxLength={140}
          disabled={busy}
          autoFocus={!editing}
        />

        <Textarea
          label="Summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="One or two lines that tell people what they will get."
          rows={2}
          error={errors.summary}
          counter={{ value: summary.length, max: 300 }}
          disabled={busy}
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="note-content" className="block text-sm font-medium text-foreground">
              Content
            </label>

            <div className="flex items-center gap-2">
              {content.trim() ? (
                <span className="text-xs text-muted-foreground">{readingTime(content)}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setPreview((value) => !value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  preview
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
          </div>

          {preview ? (
            <div className="min-h-80 rounded-xl border border-border bg-surface p-5">
              {content.trim() ? (
                <Markdown content={content} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <Textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={"Write in Markdown.\n\n## Key idea\n- Bullet points work\n- **Bold** and `code` too"}
              rows={18}
              error={errors.content}
              hint="Markdown is supported: headings, lists, tables, code blocks and links."
              className="font-mono text-[13.5px] leading-relaxed"
              disabled={busy}
            />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentUploader
              value={attachments}
              onChange={setAttachments}
              disabled={busy}
            />
            {errors.attachments ? (
              <p className="mt-2 text-xs font-medium text-danger">{errors.attachments}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
              options={visibilityOptions}
              disabled={busy}
            />

            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Mathematics"
              error={errors.subject}
              maxLength={60}
              disabled={busy}
            />

            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={suggestedTags}
              disabled={busy}
            />
            {errors.tags ? (
              <p className="text-xs font-medium text-danger">{errors.tags}</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" loading={saving === "published"} disabled={busy}>
            {saving === "published" ? null : <Send className="size-4" />}
            {editing ? "Save changes" : "Publish note"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => void submit("draft")}
            disabled={busy}
          >
            {saving === "draft" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save as draft
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>

        {coverImage ? (
          <p className="text-xs text-muted-foreground">
            The first image you attach is used as the cover on note cards.
          </p>
        ) : null}
      </aside>
    </form>
  );
}
