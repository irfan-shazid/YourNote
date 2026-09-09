import type { Metadata } from "next";

import { ReportsTable } from "@/components/admin/reports-table";
import { PageHeader } from "@/components/layout/page-header";
import { serverApi } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  const initial = await serverApi.adminReports({ pageSize: 20, status: "open" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Reports"
        description="What readers flagged, with the reported content in context."
      />

      <ReportsTable initial={initial} />
    </div>
  );
}
