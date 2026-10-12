// Run: npm run check
import assert from "node:assert/strict";
import { cheapestWindow, dailyMetrics, joinSlots, summarize, type RatePoint } from "./analytics";

const t0 = new Date("2026-01-15T00:00:00Z"); // winter: UK time = UTC
const at = (i: number) => new Date(t0.getTime() + i * 1_800_000);
const tariff = { svtRateP: 25, standingChargeP: 50 };

const slots = joinSlots(
  [
    { intervalStart: at(0), consumptionKwh: 2 }, // -5p: earns money
    { intervalStart: at(1), consumptionKwh: 1 }, // 4p: plunge
    { intervalStart: at(2), consumptionKwh: 1 }, // 30p
    { intervalStart: at(3), consumptionKwh: 9 }, // no rate: excluded
  ],
  [
    { validFrom: at(0), valueIncVat: -5 },
    { validFrom: at(1), valueIncVat: 4 },
    { validFrom: at(2), valueIncVat: 30 },
  ],
);
assert.equal(slots[3].rate, null);

const days = dailyMetrics(slots, tariff);
assert.equal(days.length, 1);
assert.equal(days[0].totalKwh, 4);
assert.equal(days[0].agileCostP, 50 - 10 + 4 + 30);
assert.equal(days[0].svtCostP, 50 + 100);
assert.equal(days[0].negativeKwh, 2);
assert.equal(days[0].plungeKwh, 3);
assert.equal(days[0].plungeSavingP, 2 * 30 + 1 * 21);

const s = summarize(days, tariff);
assert.equal(s.savingsP, 150 - 74);
assert.equal(s.avgAgileRateP, 24 / 4);
assert.equal(s.cheapPct, 75);

const rates: RatePoint[] = [30, 20, 5, 1, 2, 3, 4, 8, 40].map((rate, i) => ({ start: at(i), end: at(i + 1), rate }));
const w = cheapestWindow(rates, 3);
assert.ok(w);
assert.equal(w.start.getTime(), at(2).getTime());
assert.equal(w.avgRateP, (5 + 1 + 2 + 3 + 4 + 8) / 6);
assert.equal(cheapestWindow(rates.slice(0, 5), 3), null);

console.log("analytics checks passed");
