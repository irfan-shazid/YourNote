import type { Metadata } from "next";

import { CommentsTable } from "@/components/admin/comments-table";
import { PageHeader } from "@/components/layout/page-header";
import { serverApi } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Comments" };

export default async function AdminCommentsPage() {
  const initial = await serverApi.adminComments({ pageSize: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Comments"
        description="Remove any comment on any note. Removals are reversible and are written to the audit log."
      />

      <CommentsTable initial={initial} />
    </div>
  );
}
