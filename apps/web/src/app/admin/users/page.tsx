import type { Metadata } from "next";

import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/layout/page-header";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const [initial, user] = await Promise.all([
    serverApi.adminUsers({ pageSize: 20 }),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description={`${initial.meta.total} registered account${initial.meta.total === 1 ? "" : "s"}. Change roles, suspend abuse, remove accounts.`}
      />

      <UsersTable initial={initial} currentUserId={user?.id ?? ""} />
    </div>
  );
}
