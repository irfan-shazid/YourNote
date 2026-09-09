import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { serverApi } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Audit log" };

/** Human wording for the action codes the Go service records. */
const actionLabels: Record<string, string> = {
  "comment.remove": "removed a comment",
  "comment.restore": "restored a comment",
  "comment.purge": "deleted a comment permanently",
  "note.removed": "removed a note",
  "note.published": "restored a note",
  "note.delete": "deleted a note",
  "user.ban": "suspended an account",
  "user.unban": "lifted a suspension",
  "user.role.admin": "promoted a user to admin",
  "user.role.user": "demoted an admin to member",
  "user.delete": "deleted an account",
  "user.update": "updated an account",
  "report.resolved": "closed a report",
  "report.dismissed": "dismissed a report",
  "report.open": "reopened a report",
};

function tone(action: string): "danger" | "success" | "primary" | "default" {
  if (action.includes("delete") || action.includes("ban") || action.includes("remove")) {
    return action.includes("unban") || action.includes("restore") ? "success" : "danger";
  }
  if (action.includes("restore") || action.includes("published")) return "success";
  if (action.includes("role")) return "primary";
  return "default";
}

export default async function AdminActivityPage() {
  const { items, meta } = await serverApi.adminActivity({ pageSize: 50 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description={`${meta.total} moderation action${meta.total === 1 ? "" : "s"} recorded.`}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title="No moderation yet"
          description="Removals, bans and role changes will appear here as they happen."
        />
      ) : (
        <ol className="surface-card divide-y divide-border">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={entry.admin.name} src={entry.admin.image} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium text-foreground">{entry.admin.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {actionLabels[entry.action] ?? entry.action}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.targetType} {entry.targetId}
                  {entry.reason ? ` - "${entry.reason}"` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge tone={tone(entry.action)}>{entry.action}</Badge>
                <time className="text-xs whitespace-nowrap text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
