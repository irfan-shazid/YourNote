import type { Metadata } from "next";

import { NotesTable } from "@/components/admin/notes-table";
import { PageHeader } from "@/components/layout/page-header";
import { serverApi } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Notes" };

export default async function AdminNotesPage() {
  const initial = await serverApi.adminNotes({ pageSize: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Notes"
        description="Every note on the platform, including drafts, private notes and ones already removed."
      />

      <NotesTable initial={initial} />
    </div>
  );
}
