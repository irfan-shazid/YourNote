import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { NoteEditor } from "@/components/notes/note-editor";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit note",
};

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/notes/${slug}/edit`);

  const note = await serverApi.note(slug);
  if (!note) notFound();

  // The API is the authority; this check keeps the UI honest before rendering.
  if (!note.viewer.canEdit) redirect(`/notes/${slug}`);

  const tags = await serverApi.tags();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Editing"
        title={note.title}
        description="Changes go live as soon as you save."
      />

      <NoteEditor note={note} suggestedTags={tags.map((tag) => tag.tag)} />
    </div>
  );
}
