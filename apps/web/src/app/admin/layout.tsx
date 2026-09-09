import { Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The admin shell. Access is checked here on the server, and the Go API checks
 * the role again on every single admin endpoint - the UI guard is convenience,
 * not the security boundary.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/sign-in?next=/admin");
  if (user.role !== "admin") redirect("/");

  // A failed stats call must not take the whole panel down.
  const openReports = await serverApi
    .adminStats()
    .then((stats) => stats.openReports)
    .catch(() => 0);

  return (
    <div className="min-h-dvh bg-background">
      <header className="glass sticky top-0 z-50 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo href="/admin" />
          <Badge tone="primary" className="hidden sm:inline-flex">
            <Shield className="size-3" />
            Admin
          </Badge>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to site
            </Link>
            <ThemeToggle />
            <Avatar name={user.name} src={user.image ?? null} size="sm" ring />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminSidebar openReports={openReports} />
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
