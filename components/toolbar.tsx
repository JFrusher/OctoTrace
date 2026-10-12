"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { SyncButton } from "./sync-button";
import type { ChartPoint } from "./usage-chart";
import { cn } from "@/lib/format";

interface Props {
  range: { key: string; from: string; to: string };
  points: ChartPoint[];
}

function exportCsv(points: ChartPoint[], from: string, to: string) {
  const rows = points.map((p) =>
    [new Date(p.t).toISOString(), p.kwh, p.rate ?? "", p.costP === null ? "" : p.costP.toFixed(3)].join(","),
  );
  const csv = ["interval_start_utc,consumption_kwh,rate_p_per_kwh,cost_p", ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `agilepulse_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const chip = "inline-flex h-10 items-center rounded-md px-3 text-sm transition-colors";

export function Toolbar({ range, points }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      <nav aria-label="Date range" className="flex gap-1">
        {(["7", "30"] as const).map((d) => (
          <Link
            key={d}
            href={`/?range=${d}`}
            aria-current={range.key === d ? "page" : undefined}
            className={cn(chip, range.key === d ? "bg-muted text-fg" : "text-fg-muted hover:bg-muted/60 hover:text-fg")}
          >
            Last {d} days
          </Link>
        ))}
      </nav>

      {/* Native GET form: no client state needed for the custom range. */}
      <form action="/" className="flex flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor="from">From</label>
        <input id="from" name="from" type="date" required defaultValue={range.from}
          className="h-10 rounded-md border border-border bg-bg px-2 text-sm [color-scheme:dark]" />
        <span className="text-fg-muted" aria-hidden>–</span>
        <label className="sr-only" htmlFor="to">To</label>
        <input id="to" name="to" type="date" required defaultValue={range.to}
          className="h-10 rounded-md border border-border bg-bg px-2 text-sm [color-scheme:dark]" />
        <button type="submit"
          className={cn(chip, "cursor-pointer", range.key === "custom" ? "bg-muted text-fg" : "text-fg-muted hover:bg-muted/60 hover:text-fg")}>
          Apply
        </button>
      </form>

      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={() => exportCsv(points, range.from, range.to)}
          disabled={points.length === 0}
          className={cn(chip, "cursor-pointer gap-2 border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50")}
        >
          <Download className="size-4" aria-hidden />
          Export CSV
        </button>
        <SyncButton />
      </div>
    </div>
  );
}
