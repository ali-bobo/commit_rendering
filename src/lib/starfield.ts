// Pure, framework-agnostic helpers for the constellation renderer.
// Kept separate from renderer.ts so the math can be unit-tested without a DOM.

export interface Pt {
  x: number;
  y: number;
}

export const MIN_R = 1.6;
export const HERO_R = 6.5;

/**
 * Star radius normalized to the user's OWN busiest day, so a sparse contributor
 * still gets a prominent "hero" star. log softening keeps one huge day from
 * dwarfing everything while still letting the max-count day reach ~HERO_R.
 * A zero-commit day returns 0 (the caller skips drawing it).
 */
export function normalizedRadius(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  const m = Math.max(1, maxCount);
  const t = Math.log1p(count) / Math.log1p(m);
  return MIN_R + (HERO_R - MIN_R) * t;
}
