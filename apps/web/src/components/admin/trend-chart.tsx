"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { DayCount } from "@/types/api";

/**
 * A 14-day daily count, drawn as a bar chart in inline SVG.
 *
 * Signups and notes are deliberately rendered as two of these side by side
 * rather than one chart with two y-scales: the measures have different
 * magnitudes, and a dual-axis chart makes their relationship unreadable.
 *
 * Each panel carries a single series, so the heading names it and no legend
 * box is needed. Colours come from the validated --chart-* tokens, which are
 * re-stepped for the dark surface rather than flipped.
 */

const WIDTH = 320;
const HEIGHT = 92;
const GAP = 2; // surface gap between adjacent bars
const RADIUS = 4; // rounded data-end, square against the baseline

/** Bar path: rounded at the value end, flat where it meets the baseline. */
function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height);
  if (height <= 0) return "";

  return [
    `M ${x} ${y + height}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height}`,
    "Z",
  ].join(" ");
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function TrendChart({
  title,
  data,
  series = 1,
  className,
}: {
  title: string;
  data: DayCount[];
  /** Which validated series colour to use. */
  series?: 1 | 2;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = data.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...data.map((point) => point.count));
  const peakIndex = data.findIndex((point) => point.count === max);

  const slot = data.length > 0 ? WIDTH / data.length : WIDTH;
  const barWidth = Math.max(3, slot - GAP);
  const color = series === 1 ? "var(--color-chart-1)" : "var(--color-chart-2)";

  const active = hovered !== null ? data[hovered] : null;

  return (
    <div className={cn("surface-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Last {data.length} days</p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight tabular-nums">{total}</p>
          <p className="text-xs text-muted-foreground">total</p>
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`${title}: ${total} in the last ${data.length} days`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Recessive baseline; no gridlines, the values are labelled instead. */}
          <line
            x1="0"
            y1={HEIGHT - 0.5}
            x2={WIDTH}
            y2={HEIGHT - 0.5}
            stroke="currentColor"
            strokeWidth="1"
            className="text-border"
          />

          {data.map((point, index) => {
            const height = point.count === 0 ? 2 : (point.count / max) * (HEIGHT - 16);
            const x = index * slot;
            const y = HEIGHT - height;
            const isActive = hovered === index;

            return (
              <g key={point.date}>
                {/* Hit target is the full column, so thin bars stay easy to hover. */}
                <rect
                  x={x}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
                <path
                  d={barPath(x, y, barWidth, height)}
                  fill={color}
                  opacity={point.count === 0 ? 0.25 : isActive ? 1 : 0.85}
                  className="transition-opacity duration-150"
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {/* One selective direct label on the peak, rather than every bar. */}
          {peakIndex >= 0 && max > 0 && hovered === null ? (
            <text
              x={peakIndex * slot + barWidth / 2}
              y={HEIGHT - (max / max) * (HEIGHT - 16) - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] font-medium tabular-nums"
            >
              {max}
            </text>
          ) : null}
        </svg>

        {active ? (
          <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs shadow-lg">
            <span className="font-semibold tabular-nums text-foreground">{active.count}</span>
            <span className="text-muted-foreground"> on {formatDay(active.date)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0] ? formatDay(data[0].date) : ""}</span>
        <span>{data.at(-1) ? formatDay(data.at(-1)!.date) : ""}</span>
      </div>

      {/* Non-visual readers get the same numbers as a table, so identity and
          value never depend on the drawn marks. */}
      <table className="sr-only">
        <caption>{title} per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
