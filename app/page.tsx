import { connection } from "next/server";
import { Zap } from "lucide-react";
import { joinSlots, summarize, ukDate } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { KpiCards } from "@/components/kpi-cards";
import { UsageChart, type ChartPoint } from "@/components/usage-chart";
import { Forecast } from "@/components/forecast";
import { Toolbar } from "@/components/toolbar";
import { SyncButton } from "@/components/sync-button";
import { ukDateTime } from "@/lib/format";

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Resolve the selected UK-date window from ?range=7|30 or ?from=YYYY-MM-DD&to=YYYY-MM-DD. */
function resolveRange(sp: Record<string, string | string[] | undefined>, now: Date) {
  const from = typeof sp.from === "string" && ISO_DATE.test(sp.from) ? sp.from : null;
  const to = typeof sp.to === "string" && ISO_DATE.test(sp.to) ? sp.to : null;
  if (from && to && from <= to) return { key: "custom", from, to };
  const days = sp.range === "30" ? 30 : 7;
  return { key: String(days), from: ukDate(new Date(now.getTime() - (days - 1) * DAY_MS)), to: ukDate(now) };
}

export default async function Home({ searchParams }: { searchParams: Search }) {
  await connection(); // always render per request: `now` and DB reads must be fresh
  const now = new Date();
  const range = resolveRange(await searchParams, now);
  const account = await prisma.accountConfig.findUnique({ where: { id: "default" } });

  if (!account) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Zap className="size-10 text-accent" aria-hidden />
        <h1 className="text-2xl font-semibold">AgilePulse</h1>
        <p className="text-fg-muted">
          No data yet. Sync to pull the last 30 days from Octopus. Without API credentials in <code>.env</code>,
          realistic mock data is generated instead.
        </p>
        <SyncButton />
      </main>
    );
  }

  const tariff = { svtRateP: account.svtRatePence, standingChargeP: account.standingChargeP };
  // Query a padded UTC window, then filter by UK date so BST days are exact.
  const qFrom = new Date(`${range.from}T00:00:00Z`).getTime() - DAY_MS;
  const qTo = new Date(`${range.to}T00:00:00Z`).getTime() + 2 * DAY_MS;
  const inRange = (d: Date) => {
    const day = ukDate(d);
    return day >= range.from && day <= range.to;
  };

  const [cached, consumption, rates, upcoming] = await Promise.all([
    prisma.cachedCalculation.findMany({ where: { date: { gte: range.from, lte: range.to } }, orderBy: { date: "asc" } }),
    prisma.consumptionRecord.findMany({
      where: { meterSerial: account.meterSerial, intervalStart: { gte: new Date(qFrom), lt: new Date(qTo) } },
      orderBy: { intervalStart: "asc" },
    }),
    prisma.tariffRate.findMany({
      where: { tariffCode: account.tariffCode, validFrom: { gte: new Date(qFrom), lt: new Date(qTo) } },
    }),
    prisma.tariffRate.findMany({
      where: { tariffCode: account.tariffCode, validFrom: { gte: new Date(now.getTime() - DAY_MS) } },
      orderBy: { validFrom: "asc" },
    }),
  ]);

  const summary = summarize(cached, tariff);
  const points: ChartPoint[] = joinSlots(consumption.filter((c) => inRange(c.intervalStart)), rates).map((s) => ({
    t: s.start.getTime(),
    kwh: s.kwh,
    rate: s.rate,
    costP: s.rate === null ? null : s.kwh * s.rate,
  }));

  const today = ukDate(now);
  const tomorrow = ukDate(new Date(now.getTime() + DAY_MS));
  const tomorrowRates = upcoming.filter((r) => ukDate(r.validFrom) === tomorrow);
  const forecastDay = tomorrowRates.length > 0 ? "tomorrow" : "today";
  const forecastRates = (forecastDay === "tomorrow" ? tomorrowRates : upcoming.filter((r) => ukDate(r.validFrom) === today)).map(
    (r) => ({ start: r.validFrom.getTime(), end: r.validTo.getTime(), rate: r.valueIncVat }),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="size-6 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">AgilePulse</h1>
          {account.mode === "mock" && (
            <span className="rounded-full border border-rate-line/40 bg-rate-line/10 px-2 py-0.5 text-xs text-rate-line">
              Mock data
            </span>
          )}
        </div>
        <p className="text-sm text-fg-muted">
          {account.tariffCode} · SVT baseline {account.svtRatePence}p/kWh · Synced{" "}
          {account.lastSyncedAt ? ukDateTime(account.lastSyncedAt) : "never"}
        </p>
      </header>

      <Toolbar range={range} points={points} />
      <KpiCards summary={summary} />
      <UsageChart points={points} svtRateP={account.svtRatePence} />
      <Forecast day={forecastDay} rates={forecastRates} />
    </main>
  );
}
