"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BAND_COLOR, BAND_LABEL, pence, rateBand, ukDateTime, ukTime, type RateBand } from "@/lib/format";

export interface ChartPoint {
  t: number; // interval start, epoch ms
  kwh: number;
  rate: number | null;
  costP: number | null;
}

const BANDS: RateBand[] = ["negative", "cheap", "normal", "peak"];
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

function ChartTooltip({ point }: { point: ChartPoint }) {
  const band = point.rate === null ? null : rateBand(point.rate, new Date(point.t));
  return (
    <div className="rounded-md border border-border bg-bg/95 p-3 text-sm shadow-lg">
      <p className="font-medium">
        {ukDateTime(point.t)}–{ukTime(point.t + 1_800_000)}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 font-mono tabular-nums">
        <dt className="text-fg-muted">Usage</dt>
        <dd>{point.kwh.toFixed(3)} kWh</dd>
        <dt className="text-fg-muted">Rate</dt>
        <dd>{point.rate === null ? "—" : pence(point.rate, 2)}</dd>
        <dt className="text-fg-muted">Cost</dt>
        <dd>{point.costP === null ? "—" : pence(point.costP, 2)}</dd>
      </dl>
      {band && (
        <p className="mt-1 text-xs" style={{ color: BAND_COLOR[band] }}>
          {BAND_LABEL[band]}
        </p>
      )}
    </div>
  );
}

export function UsageChart({ points, svtRateP }: { points: ChartPoint[]; svtRateP: number }) {
  const multiDay = points.length > 48;
  // One tick per UK midnight for multi-day ranges; otherwise let Recharts space them.
  const dayTicks = multiDay ? points.filter((p) => ukTime(p.t) === "00:00").map((p) => p.t) : undefined;
  return (
    <section aria-labelledby="usage-title" className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="usage-title" className="font-medium">
          Half-hourly usage vs Agile rate
        </h2>
        <ul className="flex flex-wrap gap-3 text-xs text-fg-muted">
          {BANDS.map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: BAND_COLOR[b] }} aria-hidden />
              {BAND_LABEL[b]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-rate-line" aria-hidden />
            Agile rate
          </li>
        </ul>
      </div>
      {points.length === 0 ? (
        <p className="py-24 text-center text-fg-muted">No readings in this range. Try syncing or a different range.</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap={0}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                ticks={dayTicks}
                interval="preserveStartEnd"
                tickFormatter={(t: number) => (multiDay ? dayFmt.format(t) : ukTime(t))}
                minTickGap={24}
                stroke="var(--color-fg-muted)"
                fontSize={12}
              />
              <YAxis yAxisId="kwh" stroke="var(--color-fg-muted)" fontSize={12} width={48}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{ value: "kWh", angle: -90, position: "insideLeft", fill: "var(--color-fg-muted)", fontSize: 11 }} />
              <YAxis yAxisId="rate" orientation="right" stroke="var(--color-rate-line)" fontSize={12} unit="p" width={44} />
              <ReferenceLine
                yAxisId="rate"
                y={svtRateP}
                stroke="var(--color-fg-muted)"
                strokeDasharray="4 4"
                label={{ value: `SVT ${svtRateP}p`, fill: "var(--color-fg-muted)", fontSize: 11, position: "insideBottomRight" }}
              />
              <ReferenceLine yAxisId="rate" y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? <ChartTooltip point={payload[0].payload as ChartPoint} /> : null
                }
              />
              <Bar yAxisId="kwh" dataKey="kwh" isAnimationActive={false}>
                {points.map((p) => (
                  <Cell key={p.t} fill={p.rate === null ? "var(--color-muted)" : BAND_COLOR[rateBand(p.rate, new Date(p.t))]} />
                ))}
              </Bar>
              <Line
                yAxisId="rate"
                dataKey="rate"
                type="stepAfter"
                stroke="var(--color-rate-line)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
