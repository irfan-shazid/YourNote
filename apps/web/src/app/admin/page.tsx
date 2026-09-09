import {
  Eye,
  FileText,
  Flag,
  HardDrive,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { TrendChart } from "@/components/admin/trend-chart";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { serverApi } from "@/lib/api/server";
import { formatBytes, formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin overview",
};

export default async function AdminOverviewPage() {
  const stats = await serverApi.adminStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Platform overview"
        description="Who signed up, what they published, and what needs moderating."
      />

      {/* People. "Logged in" counts distinct users holding a live session. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          People
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Registered users"
            value={stats.totalUsers}
            icon={Users}
            tone="primary"
            hint={`${formatCount(stats.verifiedUsers)} verified`}
          />
          <StatCard
            label="Logged in now"
            value={stats.loggedInUsers}
            icon={Wifi}
            tone="success"
            hint={`${formatCount(stats.activeSessions)} active session${stats.activeSessions === 1 ? "" : "s"}`}
          />
          <StatCard
            label="New this week"
            value={stats.newUsersThisWeek}
            icon={UserPlus}
            hint={`${stats.newUsersToday} today`}
          />
          <StatCard
            label="Banned"
            value={stats.bannedUsers}
            icon={ShieldAlert}
            tone={stats.bannedUsers > 0 ? "danger" : "default"}
            hint={`${stats.adminUsers} admin${stats.adminUsers === 1 ? "" : "s"}`}
          />
        </div>
      </section>

      {/* Two single-series panels rather than one dual-axis chart: sign-ups and
          notes are different magnitudes and belong on their own scales. */}
      <section className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="New sign-ups" data={stats.signupTrend} series={1} />
        <TrendChart title="Notes published" data={stats.noteTrend} series={2} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Content
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Notes"
            value={stats.totalNotes}
            icon={FileText}
            tone="primary"
            hint={`${formatCount(stats.publicNotes)} public, ${formatCount(stats.draftNotes)} draft`}
          />
          <StatCard
            label="Comments"
            value={stats.totalComments}
            icon={MessageSquare}
            hint={`${formatCount(stats.hiddenComments)} removed`}
          />
          <StatCard
            label="Reactions"
            value={stats.totalReactions}
            icon={Sparkles}
            tone="success"
          />
          <StatCard label="Views" value={stats.totalViews} icon={Eye} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Attachments"
            value={stats.attachments}
            icon={Paperclip}
            hint="PDFs and images on Cloudinary"
          />
          <StatCard
            label="Storage used"
            value={formatBytes(stats.storageBytes)}
            icon={HardDrive}
            raw
          />
          <StatCard
            label="Open reports"
            value={stats.openReports}
            icon={Flag}
            tone={stats.openReports > 0 ? "warning" : "default"}
            hint={stats.openReports > 0 ? "Needs review" : "Nothing waiting"}
          />
          <StatCard
            label="Removed notes"
            value={stats.removedNotes}
            icon={ShieldAlert}
            tone={stats.removedNotes > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border p-5 py-4">
            <h2 className="text-sm font-semibold">Newest members</h2>
            <Link href="/admin/users" className="text-xs font-medium text-primary hover:underline">
              Manage users
            </Link>
          </div>

          <ul className="divide-y divide-border">
            {stats.recentUsers.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">No one has signed up yet.</li>
            ) : (
              stats.recentUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-3 p-4">
                  <Avatar name={user.name} src={user.image} size="sm" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {user.activeSession ? (
                      <Badge tone="success" className="px-1.5 py-0 text-[10px]">
                        Online
                      </Badge>
                    ) : null}
                    {user.role === "admin" ? (
                      <Badge tone="primary" className="px-1.5 py-0 text-[10px]">
                        Admin
                      </Badge>
                    ) : null}
                    {!user.emailVerified ? (
                      <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                        Unverified
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border p-5 py-4">
            <h2 className="text-sm font-semibold">Most reacted notes</h2>
            <Link href="/admin/notes" className="text-xs font-medium text-primary hover:underline">
              Manage notes
            </Link>
          </div>

          <ul className="divide-y divide-border">
            {stats.topNotes.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">No notes yet.</li>
            ) : (
              stats.topNotes.map((note) => (
                <li key={note.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/notes/${note.slug}`}
                      className="line-clamp-1 text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {note.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      by {note.author.name}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      {formatCount(note.stats.reactions)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3.5" />
                      {formatCount(note.stats.comments)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="surface-card flex flex-wrap items-center gap-4 p-5">
        <UserCheck className="size-5 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Every removal, ban and role change is written to the audit log with the
          admin who did it.
        </p>
        <Link href="/admin/activity" className="text-sm font-medium text-primary hover:underline">
          Open the audit log
        </Link>
      </section>
    </div>
  );
}
