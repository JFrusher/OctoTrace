import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CHEAP_THRESHOLD_P, isPeak } from "./analytics";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const pounds = (pence: number) =>
  (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export const pence = (p: number, digits = 1) => `${p.toFixed(digits)}p`;

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export const ukTime = (d: Date | number) => timeFmt.format(d);
export const ukDateTime = (d: Date | number) => dateTimeFmt.format(d);

export type RateBand = "negative" | "cheap" | "peak" | "normal";

export function rateBand(rate: number, start: Date): RateBand {
  if (rate < 0) return "negative";
  if (rate < CHEAP_THRESHOLD_P) return "cheap";
  if (isPeak(start)) return "peak";
  return "normal";
}

export const BAND_COLOR: Record<RateBand, string> = {
  negative: "var(--color-negative)",
  cheap: "var(--color-cheap)",
  peak: "var(--color-peak)",
  normal: "var(--color-normal)",
};

export const BAND_LABEL: Record<RateBand, string> = {
  negative: "Negative (<0p)",
  cheap: `Cheap (<${CHEAP_THRESHOLD_P}p)`,
  peak: "Peak 4–7pm",
  normal: "Standard",
};
