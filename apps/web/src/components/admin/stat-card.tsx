import type { LucideIcon } from "lucide-react";

import { cn, formatCount } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  raw = false,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  /** Show the value as given instead of compacting it. */
  raw?: boolean;
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/14 text-warning",
    danger: "bg-danger/12 text-danger",
  } as const;

  return (
    <div className="surface-card hover-lift p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
        {typeof value === "number" && !raw ? formatCount(value) : value}
      </p>

      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
