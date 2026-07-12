/**
 * Diffraction-spike star selection (pure, node:test-able).
 *
 * Only the year's brightest few stars get the "＋" cross spikes, echoing how
 * only the brightest stars bloom in astrophotography. Selection must be
 * deterministic so the capture and the live site always agree.
 */

/**
 * Indices of the n highest-count days. Ties break to the earlier date; days
 * with count = 0 (unlit stars) never qualify. Fewer than n lit days → all of
 * them. Result is in selection order (brightest first).
 */
export function topStarIndices(
  days: { date: string; count: number }[],
  n: number
): number[] {
  return days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.count > 0)
    .sort((a, b) => b.d.count - a.d.count || (a.d.date < b.d.date ? -1 : 1))
    .slice(0, n)
    .map(({ i }) => i);
}
