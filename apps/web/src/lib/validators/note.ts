import { z } from "zod";

/**
 * Client-side mirror of the Go validation rules in
 * apps/api/internal/models/note.go. The API remains the authority; this exists
 * so the form can fail fast without a round trip.
 */
export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Titles need at least 3 characters.")
    .max(140, "Titles are limited to 140 characters."),
  summary: z
    .string()
    .trim()
    .max(300, "Summaries are limited to 300 characters.")
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, "A note needs some content.")
    .max(100000, "This note is too long to save."),
  subject: z
    .string()
    .trim()
    .max(60, "Subjects are limited to 60 characters.")
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(24, "Each tag is limited to 24 characters."))
    .max(8, "Use at most 8 tags."),
  visibility: z.enum(["public", "unlisted", "private"]),
  status: z.enum(["published", "draft"]),
});

export type NoteFormValues = z.infer<typeof noteSchema>;

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something before posting.")
    .max(2000, "Comments are limited to 2000 characters."),
});

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Names need at least 2 characters.")
    .max(60, "Names are limited to 60 characters."),
  bio: z.string().trim().max(280, "Bios are limited to 280 characters.").optional(),
});

/** Normalise tags the same way the Go service does, so previews match. */
export function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const raw of tags) {
    const clean = raw
      .toLowerCase()
      .trim()
      .replace(/^#+|#+$/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .join("-");

    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }
  return output;
}
