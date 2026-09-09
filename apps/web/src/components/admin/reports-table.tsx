"use client";

import { CheckCircle2, ExternalLink, Flag, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { Paginated, PaginationMeta, Report } from "@/types/api";

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "Everything" },
];

export function ReportsTable({ initial }: { initial: Paginated<Report> }) {
  const [reports, setReports] = useState(initial.items);
  const [meta, setMeta] = useState<PaginationMeta>(initial.meta);
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.reports({ page, pageSize: 20, status });
      setReports(result.items);
      setMeta(result.meta);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(report: Report, next: "resolved" | "dismissed") {
    setBusyId(report.id);
    try {
      await api.admin.resolveReport(report.id, next);
      toast.success(next === "resolved" ? "Marked as handled." : "Report dismissed.");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update that report.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={statusOptions}
          aria-label="Filter reports"
          className="w-44"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-6" />}
          title="Nothing waiting"
          description="No reports match this filter. That is a good sign."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={report.reporter.name} src={report.reporter.image} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-foreground">{report.reporter.name}</span>
                      <span className="text-muted-foreground"> reported a {report.targetType}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Badge
                  tone={
                    report.status === "open"
                      ? "warning"
                      : report.status === "resolved"
                        ? "success"
                        : "default"
                  }
                  className="capitalize"
                >
                  {report.status}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-foreground">{report.reason}</p>
                {report.details ? (
                  <p className="text-sm text-muted-foreground">{report.details}</p>
                ) : null}

                {report.preview ? (
                  <blockquote className="rounded-xl border-l-2 border-border bg-muted/60 p-3 text-sm break-words text-muted-foreground">
                    {report.preview}
                  </blockquote>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    The reported content no longer exists.
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                {report.link ? (
                  <Link
                    href={`/notes/${report.link}${report.targetType === "comment" ? "#comments" : ""}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Open in context
                  </Link>
                ) : (
                  <span />
                )}

                {report.status === "open" ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void resolve(report, "dismissed")}
                      disabled={busyId === report.id}
                    >
                      <XCircle className="size-3.5" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void resolve(report, "resolved")}
                      disabled={busyId === report.id}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Mark handled
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {report.resolvedAt
                      ? `Closed ${new Date(report.resolvedAt).toLocaleDateString()}`
                      : ""}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination meta={meta} onChange={setPage} />
    </div>
  );
}
