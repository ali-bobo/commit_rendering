import type { ConstellationData, DayStar } from "./types";
import { normalizedRadius } from "./starfield";
import { arcPoint, arcNormal, arcTangent } from "./arc";
import { FALLBACK_COLOR } from "./color";
import { snapFreq } from "./loopfreq";

export interface Star {
  day: DayStar;
  bx: number; // base position 0..100 (percent of canvas)
  by: number;
  x: number; // live pixel position
  y: number;
  r: number; // base radius from magnitude
  t: number; // 0..1 progress along the year arc
  twk: number; // twinkle phase
  tws: number; // twinkle speed
  spin: number; // per-star swirl factor for the black-hole transform
  col: string;
  monthLabel: string;
  swallowed: boolean; // transient: true when consumed by the black hole this frame
}

export interface MonthAnchor {
  label: string;
  t: number;
}

export const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 99.7) * 43758.5453;
    return s - Math.floor(s);
  };
}

/** Stable hash of an ISO date so a day's jitter never changes between renders. */
function hashDate(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Builds star layout from the data. Each day is placed along the year arc by its
 * date (oldest→newest = t 0→1), with a small seeded perpendicular jitter so the
 * arm reads as a star cloud rather than a hard line. Returned in date order.
 */
export function buildStars(data: ConstellationData): Star[] {
  const colorByLang = new Map<string, string>();
  for (const l of data.languages) colorByLang.set(l.name, l.color);

  const N = data.days.length;
  const maxCount = data.days.reduce((m, d) => Math.max(m, d.count), 0);
  const stars: Star[] = [];
  data.days.forEach((day, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const base = arcPoint(t);
    const norm = arcNormal(t);
    const tan = arcTangent(t);
    const tlen = Math.hypot(tan.x, tan.y) || 1;
    const rand = seededRand(hashDate(day.date));
    const jN = (rand() * 2 - 1) * 9.5;
    const jT = (rand() * 2 - 1) * 2.5;
    stars.push({
      day,
      bx: base.x + norm.x * jN + (tan.x / tlen) * jT,
      by: base.y + norm.y * jN + (tan.y / tlen) * jT,
      x: 0,
      y: 0,
      r: normalizedRadius(day.count, maxCount),
      t,
      twk: rand(),
      tws: 0.6 + rand() * 1.3,
      spin: 0.7 + rand() * 0.7,
      col: (day.language && colorByLang.get(day.language)) || FALLBACK_COLOR,
      monthLabel: MONTHS[new Date(day.date + "T00:00:00").getMonth()] ?? "",
      swallowed: false,
    });
  });
  return stars;
}

/** Where each present month sits along the arc (mean t of its days). */
export function buildMonthAnchors(data: ConstellationData): MonthAnchor[] {
  const N = data.days.length;
  const acc = new Map<number, { sum: number; n: number }>();
  data.days.forEach((day, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const m = new Date(day.date + "T00:00:00").getMonth();
    const e = acc.get(m) ?? { sum: 0, n: 0 };
    e.sum += t;
    e.n += 1;
    acc.set(m, e);
  });
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, e]) => ({ label: MONTHS[m] ?? `${m + 1}月`, t: e.sum / e.n }));
}

/**
 * Target drift position (percent space) for a star at time tt. The gentle sway
 * is keyed to arc position so the whole arm breathes coherently. Pure: the
 * caller converts to px and applies smoothing.
 */
export function driftPos(
  star: Star,
  tt: number,
  loopPeriod?: number | null
): { x: number; y: number } {
  // In loop/capture mode, snap the two sway frequencies to harmonics of the loop
  // period so the drift returns to the same phase at the seam (seamless loop).
  const fx = loopPeriod ? snapFreq(0.5, loopPeriod) : 0.5;
  const fy = loopPeriod ? snapFreq(0.42, loopPeriod) : 0.42;
  const ph = star.t * 6.28 * 2;
  const ox = Math.sin(tt * fx + ph) * 1.5;
  const oy = Math.cos(tt * fy + ph) * 1.2;
  return { x: star.bx + ox, y: star.by + oy };
}
