import { ukHour } from "./analytics";

const BASE_URL = "https://api.octopus.energy/v1";
const MAX_RETRIES = 4;
const HALF_HOUR_MS = 30 * 60 * 1000;

interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface ApiConsumption {
  consumption: number;
  interval_start: string;
  interval_end: string;
}

interface ApiRate {
  value_inc_vat: number;
  valid_from: string;
  valid_to: string | null;
}

export interface ConsumptionInput {
  intervalStart: Date;
  intervalEnd: Date;
  consumptionKwh: number;
}

export interface RateInput {
  validFrom: Date;
  validTo: Date;
  valueIncVat: number;
}

export class OctopusApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OctopusApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with Basic auth (API key as username, empty password) and retry on 429/5xx/network errors. */
async function request<T>(url: string, apiKey: string | undefined, attempt = 0): Promise<T> {
  const headers: HeadersInit = apiKey
    ? { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` }
    : {};
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    await sleep(500 * 2 ** attempt);
    return request(url, apiKey, attempt + 1);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
    return request(url, apiKey, attempt + 1);
  }
  if (!res.ok) {
    const hint = res.status === 401 ? " (check OCTOPUS_API_KEY)" : res.status === 404 ? " (check MPAN/serial/tariff code)" : "";
    throw new OctopusApiError(`Octopus API returned ${res.status} for ${new URL(url).pathname}${hint}`, res.status);
  }
  return (await res.json()) as T;
}

async function fetchAllPages<T>(url: string, apiKey?: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const page: Page<T> = await request<Page<T>>(next, apiKey);
    out.push(...page.results);
    next = page.next;
  }
  return out;
}

const range = (from: Date, to: Date) =>
  `period_from=${encodeURIComponent(from.toISOString())}&period_to=${encodeURIComponent(to.toISOString())}`;

/** E-1R-AGILE-24-10-01-C -> AGILE-24-10-01 */
export function productCodeFromTariff(tariffCode: string): string {
  const m = /^E-[12]R-(.+)-[A-P]$/.exec(tariffCode);
  if (!m) throw new Error(`Unrecognised tariff code "${tariffCode}" (expected e.g. E-1R-AGILE-24-10-01-C)`);
  return m[1];
}

export async function fetchConsumption(
  apiKey: string,
  mpan: string,
  serial: string,
  from: Date,
  to: Date,
): Promise<ConsumptionInput[]> {
  const url = `${BASE_URL}/electricity-meter-points/${mpan}/meters/${serial}/consumption/?${range(from, to)}&page_size=25000&order_by=period`;
  const rows = await fetchAllPages<ApiConsumption>(url, apiKey);
  return rows.map((r) => ({
    intervalStart: new Date(r.interval_start),
    intervalEnd: new Date(r.interval_end),
    consumptionKwh: r.consumption,
  }));
}

export async function fetchAgileRates(tariffCode: string, from: Date, to: Date, apiKey?: string): Promise<RateInput[]> {
  const product = productCodeFromTariff(tariffCode);
  const url = `${BASE_URL}/products/${product}/electricity-tariffs/${tariffCode}/standard-unit-rates/?${range(from, to)}&page_size=1500`;
  const rows = await fetchAllPages<ApiRate>(url, apiKey);
  return rows.map((r) => {
    const validFrom = new Date(r.valid_from);
    return {
      validFrom,
      validTo: r.valid_to ? new Date(r.valid_to) : new Date(validFrom.getTime() + HALF_HOUR_MS),
      valueIncVat: r.value_inc_vat,
    };
  });
}

// ---------------------------------------------------------------------------
// Mock data: realistic-looking UK Agile prices and household load, deterministic
// per slot so repeated syncs produce the same numbers.
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function slotsBetween(from: Date, to: Date): Date[] {
  const start = Math.ceil(from.getTime() / HALF_HOUR_MS) * HALF_HOUR_MS;
  const out: Date[] = [];
  for (let t = start; t < to.getTime(); t += HALF_HOUR_MS) out.push(new Date(t));
  return out;
}

export function mockRates(from: Date, to: Date): RateInput[] {
  return slotsBetween(from, to).map((start) => {
    const slot = start.getTime() / HALF_HOUR_MS;
    const day = Math.floor(slot / 48);
    const h = ukHour(start) + (start.getUTCMinutes() >= 30 ? 0.5 : 0);
    const windy = rand(day) < 0.25; // ~1 in 4 days has an overnight plunge
    let p = 18 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI); // daytime shape
    if (h < 6) p = windy ? -4 + 6 * rand(slot) : 9 + 4 * rand(slot); // overnight trough
    else if (h >= 13 && h < 15.5) p -= 4; // solar dip
    else if (h >= 16 && h < 19) p = 30 + 12 * rand(slot); // peak
    p += (rand(slot + 7) - 0.5) * 3;
    return {
      validFrom: start,
      validTo: new Date(start.getTime() + HALF_HOUR_MS),
      valueIncVat: Math.round(Math.min(p, 100) * 100) / 100,
    };
  });
}

export function mockConsumption(from: Date, to: Date): ConsumptionInput[] {
  return slotsBetween(from, to).map((start) => {
    const slot = start.getTime() / HALF_HOUR_MS;
    const day = Math.floor(slot / 48);
    const h = ukHour(start);
    let kwh = 0.12 + rand(slot) * 0.08; // baseload
    if (h >= 7 && h < 9) kwh += 0.35 * rand(slot + 1);
    if (h >= 17 && h < 22) kwh += 0.25 + 0.4 * rand(slot + 2);
    if (h >= 1 && h < 5 && rand(day + 99) < 0.6) kwh += 3.2; // EV charging most nights
    return {
      intervalStart: start,
      intervalEnd: new Date(start.getTime() + HALF_HOUR_MS),
      consumptionKwh: Math.round(kwh * 1000) / 1000,
    };
  });
}
