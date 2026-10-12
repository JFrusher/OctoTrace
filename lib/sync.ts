import { dailyMetrics, joinSlots } from "./analytics";
import { prisma } from "./db";
import { fetchAgileRates, fetchConsumption, mockConsumption, mockRates } from "./octopus";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;

export interface SyncResult {
  mode: "live" | "mock";
  consumptionRows: number;
  rateRows: number;
  days: number;
}

function readEnvConfig() {
  const apiKey = process.env.OCTOPUS_API_KEY?.trim();
  const mpan = process.env.OCTOPUS_MPAN?.trim();
  const meterSerial = process.env.OCTOPUS_METER_SERIAL?.trim();
  const live = Boolean(apiKey && mpan && meterSerial);
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) ? n : fallback;
  };
  return {
    live,
    apiKey,
    mpan: live ? mpan! : "MOCK",
    meterSerial: live ? meterSerial! : "MOCK",
    tariffCode: process.env.OCTOPUS_TARIFF_CODE?.trim() || "E-1R-AGILE-24-10-01-C",
    svtRatePence: num(process.env.SVT_RATE_PENCE, 24.5),
    standingChargeP: num(process.env.STANDING_CHARGE_PENCE, 50),
  };
}

/**
 * Pull the last 30 days of consumption plus rates up to the end of tomorrow, replace that window
 * in the DB, then rebuild the daily cache. Falls back to mock data when no API credentials are set.
 */
export async function syncOctopusData(): Promise<SyncResult> {
  const cfg = readEnvConfig();
  const now = new Date();
  const from = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS - HISTORY_DAYS * DAY_MS);
  const ratesTo = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + 2 * DAY_MS);

  const [consumption, rates] = cfg.live
    ? await Promise.all([
        fetchConsumption(cfg.apiKey!, cfg.mpan, cfg.meterSerial, from, now),
        fetchAgileRates(cfg.tariffCode, from, ratesTo, cfg.apiKey),
      ])
    : [mockConsumption(from, new Date(Math.floor(now.getTime() / 1_800_000) * 1_800_000)), mockRates(from, ratesTo)];

  // Replace-in-window is an idempotent upsert for a whole range, and much faster than per-row upserts in SQLite.
  await prisma.$transaction([
    prisma.consumptionRecord.deleteMany({ where: { meterSerial: cfg.meterSerial, intervalStart: { gte: from } } }),
    prisma.consumptionRecord.createMany({ data: consumption.map((c) => ({ ...c, meterSerial: cfg.meterSerial })) }),
    prisma.tariffRate.deleteMany({ where: { tariffCode: cfg.tariffCode, validFrom: { gte: from } } }),
    prisma.tariffRate.createMany({ data: rates.map((r) => ({ ...r, tariffCode: cfg.tariffCode })) }),
    prisma.accountConfig.upsert({
      where: { id: "default" },
      create: { ...pick(cfg), lastSyncedAt: now },
      update: { ...pick(cfg), lastSyncedAt: now },
    }),
  ]);

  const days = await rebuildDailyCache(cfg.meterSerial, cfg.tariffCode, cfg);
  return { mode: cfg.live ? "live" : "mock", consumptionRows: consumption.length, rateRows: rates.length, days };
}

function pick(cfg: ReturnType<typeof readEnvConfig>) {
  return {
    mpan: cfg.mpan,
    meterSerial: cfg.meterSerial,
    tariffCode: cfg.tariffCode,
    svtRatePence: cfg.svtRatePence,
    standingChargeP: cfg.standingChargeP,
    mode: cfg.live ? "live" : "mock",
  };
}

// ponytail: rebuilds every day each sync; fine for years of half-hourly data in SQLite,
// restrict to the synced window if it ever gets slow.
async function rebuildDailyCache(
  meterSerial: string,
  tariffCode: string,
  tariff: { svtRatePence: number; standingChargeP: number },
): Promise<number> {
  const [consumption, rates] = await Promise.all([
    prisma.consumptionRecord.findMany({ where: { meterSerial }, orderBy: { intervalStart: "asc" } }),
    prisma.tariffRate.findMany({ where: { tariffCode } }),
  ]);
  const days = dailyMetrics(joinSlots(consumption, rates), {
    svtRateP: tariff.svtRatePence,
    standingChargeP: tariff.standingChargeP,
  });
  await prisma.$transaction([prisma.cachedCalculation.deleteMany(), prisma.cachedCalculation.createMany({ data: days })]);
  return days.length;
}
