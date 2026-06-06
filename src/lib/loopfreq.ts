/**
 * Snap an angular frequency (rad/s) to the nearest harmonic of a loop period, so
 * that sin(snapped * t) completes a whole number of cycles over `period` seconds
 * — making any animation driven by it loop seamlessly. Never returns 0: a
 * sub-one-cycle frequency is rounded up to exactly one cycle per period.
 */
export function snapFreq(freq: number, period: number): number {
  const TAU = 2 * Math.PI;
  const cycles = Math.max(1, Math.round((freq * period) / TAU));
  return (cycles * TAU) / period;
}
