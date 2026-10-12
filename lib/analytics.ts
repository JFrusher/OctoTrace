// Pure calculation engine. All money values are in pence; convert at the UI edge.

export const PLUNGE_THRESHOLD_P = 5; // "plunge" pricing: below 5p/kWh
export const CHEAP_THRESHOLD_P = 10;
export const PEAK_START_HOUR = 16; // 4pm–7pm UK time
export const PEAK_END_HOUR = 19;

const UK_TZ = "Europe/London";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: UK_TZ }); // YYYY-MM-DD
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, hour: "2-digit", hourCycle: "h23" });

export interface Slot {
  start: Date;
  kwh: number;
  /** Agile unit rate in p/kWh inc VAT; null when no rate is known for the slot. */
  rate: number | null;
}

export interface RatePoint {
  start: Date;
  end: Date;
  rate: number;
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD, UK local
  totalKwh: number;
  agileCostP: number;
  svtCostP: number;
  cheapKwh: number; // rate < CHEAP_THRESHOLD_P
  plungeKwh: number; // rate < PLUNGE_THRESHOLD_P (includes negative)
  negativeKwh: number; // rate < 0
  plungeSavingP: number; // saved vs SVT during plunge slots (includes money earned)
}

export interface Summary {
  days: number;
  totalKwh: number;
  agileCostP: number;
  svtCostP: number;
  savingsP: number;
  savingsPct: number;
  avgAgileRateP: number; // effective p/kWh paid, excluding standing charge
  svtRateP: number;
  cheapPct: number;
  plungeKwh: number;
  negativeKwh: number;
  plungeSavingP: number;
}

export interface Tariff {
  svtRateP: number;
  standingChargeP: number; // per day, applied identically to both tariffs
}

export const ukDate = (d: Date): string => dayFmt.format(d);
export const ukHour = (d: Date): number => Number(hourFmt.format(d));
export const isPeak = (d: Date): boolean => {
  const h = ukHour(d);
  return h >= PEAK_START_HOUR && h < PEAK_END_HOUR;
};

/** Join consumption with rates by interval start. Slots without a matching rate get rate = null. */
export function joinSlots(
  consumption: { intervalStart: Date; consumptionKwh: number }[],
  rates: { validFrom: Date; valueIncVat: number }[],
): Slot[] {
  const byStart = new Map(rates.map((r) => [r.validFrom.getTime(), r.valueIncVat]));
  return consumption.map((c) => ({
    start: c.intervalStart,
    kwh: c.consumptionKwh,
    rate: byStart.get(c.intervalStart.getTime()) ?? null,
  }));
}

/** Aggregate slots into per-day metrics. Slots without a rate are skipped so costs never silently use 0p. */
export function dailyMetrics(slots: Slot[], tariff: Tariff): DailyMetric[] {
  const days = new Map<string, DailyMetric>();
  for (const s of slots) {
    if (s.rate === null) continue;
    const date = ukDate(s.start);
    let d = days.get(date);
    if (!d) {
      d = {
        date,
        totalKwh: 0,
        agileCostP: tariff.standingChargeP,
        svtCostP: tariff.standingChargeP,
        cheapKwh: 0,
        plungeKwh: 0,
        negativeKwh: 0,
        plungeSavingP: 0,
      };
      days.set(date, d);
    }
    d.totalKwh += s.kwh;
    d.agileCostP += s.kwh * s.rate;
    d.svtCostP += s.kwh * tariff.svtRateP;
    if (s.rate < CHEAP_THRESHOLD_P) d.cheapKwh += s.kwh;
    if (s.rate < PLUNGE_THRESHOLD_P) {
      d.plungeKwh += s.kwh;
      d.plungeSavingP += s.kwh * (tariff.svtRateP - s.rate);
    }
    if (s.rate < 0) d.negativeKwh += s.kwh;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function summarize(days: DailyMetric[], tariff: Tariff): Summary {
  const sum = (k: keyof Omit<DailyMetric, "date">) => days.reduce((acc, d) => acc + d[k], 0);
  const totalKwh = sum("totalKwh");
  const agileCostP = sum("agileCostP");
  const svtCostP = sum("svtCostP");
  const savingsP = svtCostP - agileCostP;
  const unitCostP = agileCostP - days.length * tariff.standingChargeP;
  return {
    days: days.length,
    totalKwh,
    agileCostP,
    svtCostP,
    savingsP,
    savingsPct: svtCostP > 0 ? (savingsP / svtCostP) * 100 : 0,
    avgAgileRateP: totalKwh > 0 ? unitCostP / totalKwh : 0,
    svtRateP: tariff.svtRateP,
    cheapPct: totalKwh > 0 ? (sum("cheapKwh") / totalKwh) * 100 : 0,
    plungeKwh: sum("plungeKwh"),
    negativeKwh: sum("negativeKwh"),
    plungeSavingP: sum("plungeSavingP"),
  };
}

export interface CheapestWindow {
  start: Date;
  end: Date;
  avgRateP: number;
}

/** Cheapest run of consecutive half-hour slots covering `hours`. Rates must be sorted by start. */
export function cheapestWindow(rates: RatePoint[], hours = 3): CheapestWindow | null {
  const n = hours * 2;
  if (rates.length < n) return null;
  let best: CheapestWindow | null = null;
  let windowSum = 0;
  for (let i = 0; i < rates.length; i++) {
    windowSum += rates[i].rate;
    if (i >= n) windowSum -= rates[i - n].rate;
    if (i < n - 1) continue;
    const first = rates[i - n + 1];
    // Skip windows that span a gap in published rates.
    if (rates[i].end.getTime() - first.start.getTime() !== hours * 3_600_000) continue;
    const avg = windowSum / n;
    if (!best || avg < best.avgRateP) best = { start: first.start, end: rates[i].end, avgRateP: avg };
  }
  return best;
}
