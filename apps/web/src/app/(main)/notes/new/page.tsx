import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { NoteEditor } from "@/components/notes/note-editor";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Write a note",
};

export default async function NewNotePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/notes/new");

  const tags = await serverApi.tags();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="New note"
        title="Write a note"
        description="Markdown is supported. Attach the PDFs and images that go with it."
      />

      <NoteEditor suggestedTags={tags.map((tag) => tag.tag)} />
    </div>
  );
}
