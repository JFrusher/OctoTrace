import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { cheapestWindow } from "@/lib/analytics";
import { BAND_COLOR, cn, pence, rateBand, ukTime } from "@/lib/format";

const SPIKE_P = 35;

interface Props {
  day: "today" | "tomorrow";
  rates: { start: number; end: number; rate: number }[];
}

export function Forecast({ day, rates }: Props) {
  const best = cheapestWindow(
    rates.map((r) => ({ start: new Date(r.start), end: new Date(r.end), rate: r.rate })),
    3,
  );
  const inWindow = (t: number) => best !== null && t >= best.start.getTime() && t < best.end.getTime();
  const spikes = rates.filter((r) => r.rate >= SPIKE_P);
  const min = rates.reduce<(typeof rates)[number] | null>((m, r) => (!m || r.rate < m.rate ? r : m), null);
  const max = rates.reduce<(typeof rates)[number] | null>((m, r) => (!m || r.rate > m.rate ? r : m), null);

  return (
    <section aria-labelledby="forecast-title" className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="forecast-title" className="font-medium">
          {day === "tomorrow" ? "Tomorrow's prices" : "Today's prices"}
        </h2>
        {day === "today" && <p className="text-sm text-fg-muted">Tomorrow&apos;s rates publish around 4pm.</p>}
      </div>

      {rates.length === 0 ? (
        <p className="py-8 text-center text-fg-muted">No published rates yet. Sync to fetch the latest.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Clock} label="Cheapest 3-hour window" accent>
              {best ? `${ukTime(best.start)}–${ukTime(best.end)} · avg ${pence(best.avgRateP)}` : "Not enough slots"}
            </Stat>
            <Stat icon={TrendingDown} label="Lowest slot">
              {min && `${ukTime(min.start)} · ${pence(min.rate, 2)}`}
            </Stat>
            <Stat icon={AlertTriangle} label={`Peak spikes (≥${SPIKE_P}p)`} warn={spikes.length > 0}>
              {spikes.length > 0 && max ? `${spikes.length} slots · max ${pence(max.rate, 2)} at ${ukTime(max.start)}` : "None"}
            </Stat>
          </div>

          <ol aria-label="Half-hourly prices" className="mt-4 grid grid-cols-12 gap-1 sm:grid-cols-24 xl:grid-cols-48">
            {rates.map((r) => {
              const band = rateBand(r.rate, new Date(r.start));
              const cheap = inWindow(r.start);
              const spike = r.rate >= SPIKE_P;
              return (
                <li
                  key={r.start}
                  title={`${ukTime(r.start)} · ${pence(r.rate, 2)}`}
                  aria-label={`${ukTime(r.start)}: ${pence(r.rate, 2)}${cheap ? ", in cheapest best" : ""}${spike ? ", price spike" : ""}`}
                  className={cn(
                    "flex h-12 flex-col items-center justify-end rounded-sm pb-0.5 font-mono text-[10px]",
                    cheap && "ring-2 ring-fg",
                    spike && "ring-2 ring-peak",
                  )}
                  style={{
                    background: `color-mix(in oklab, ${BAND_COLOR[band]} ${Math.round(35 + Math.min(Math.abs(r.rate), 40) * 1.5)}%, transparent)`,
                  }}
                >
                  <span aria-hidden>{Math.round(r.rate)}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-2 flex justify-between text-xs text-fg-muted" aria-hidden>
            <span>{ukTime(rates[0].start)}</span>
            <span>{ukTime(rates[Math.floor(rates.length / 2)].start)}</span>
            <span>{ukTime(rates[rates.length - 1].end)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, children, accent, warn }: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <div className={cn("flex items-center gap-1.5 text-xs", warn ? "text-peak" : accent ? "text-accent" : "text-fg-muted")}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-mono text-sm tabular-nums">{children}</p>
    </div>
  );
}
