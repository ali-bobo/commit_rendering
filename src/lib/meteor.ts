/**
 * Pure meteor geometry, in percent space (0..100). Layers convert to px
 * (widths are already px and are used as-is).
 *
 * A meteor is a small head glow trailing a tapered, gently curved tail. The
 * tail follows a quadratic Bézier so the streak reads as a real shooting star
 * rather than a straight scratch. Everything here is a pure function of the
 * flight progress `u` (and, for the scripted capture meteor, the loop phase),
 * so the seamless-loop capture never depends on frame-to-frame random state —
 * the seam bug the old Math.random simulation had.
 */

export interface MeteorSample {
  x: number;
  y: number;
  w: number; // stroke width in px
  a: number; // alpha along the tail (0.9 at head → 0 at the far tip)
}

export interface MeteorFrame {
  samples: MeteorSample[];
  headX: number;
  headY: number;
  alpha: number; // overall life alpha (0 at both ends → seam-safe)
}

// --- Tail taper (px widths, sample count, reach along the path in u units) ---
export const TAIL_W_HEAD = 2.6;
export const TAIL_W_TIP = 0.3;
export const TAIL_SAMPLES = 10;
export const TAIL_U = 0.09;

// --- Scripted (capture/loop) meteor constants ---
export const SPAWN = 0.3; // s: appears just after loop start (static PNG at tt≈0.8 catches it)
export const DURATION = 3.0; // s: full flight length; SPAWN+DURATION must end before collapse
// Trajectory in percent space: crosses the empty upper-right, away from the
// lower-left star cluster.
export const P0: readonly [number, number] = [88, -3];
export const P1: readonly [number, number] = [64, 34];
/** Control-point offset along the chord normal (percent). Small = "notice it
 *  only if you look" curvature (≈6% of the chord length). */
export const CTRL_OFFSET = 2.2;

type Pt = { x: number; y: number };

/** Point on the quadratic Bézier p0→c→p1 at u∈[0,1] (clamped). Percent space. */
export function meteorPoint(
  p0: readonly [number, number],
  c: readonly [number, number],
  p1: readonly [number, number],
  u: number
): Pt {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  const mt = 1 - t;
  return {
    x: mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
    y: mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1],
  };
}

/**
 * Overall life alpha at flight progress u∈[0,1]: ramps in over the first 10%,
 * out over the last 25%, exactly 0 at both endpoints — so a meteor near the
 * loop seam contributes nothing there and can never pop in/out.
 */
export function meteorAlpha(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const rampIn = u < 0.1 ? u / 0.1 : 1;
  const rampOut = u > 0.75 ? (1 - u) / 0.25 : 1;
  return rampIn * rampOut;
}

/**
 * Tail samples for a head at flight progress u: TAIL_SAMPLES points, head-most
 * first, widths strictly decreasing TAIL_W_HEAD→TAIL_W_TIP, per-sample alpha
 * fading 0.9→0. `tailU` is how far back the tail reaches in u units.
 */
export function meteorTail(
  p0: readonly [number, number],
  c: readonly [number, number],
  p1: readonly [number, number],
  u: number,
  tailU: number
): MeteorSample[] {
  const out: MeteorSample[] = [];
  const last = TAIL_SAMPLES - 1;
  for (let i = 0; i < TAIL_SAMPLES; i++) {
    const k = i / last; // 0 at head, 1 at tip
    const p = meteorPoint(p0, c, p1, Math.max(0, u - tailU * k));
    out.push({
      x: p.x,
      y: p.y,
      w: TAIL_W_HEAD + (TAIL_W_TIP - TAIL_W_HEAD) * k,
      a: 0.9 * (1 - k),
    });
  }
  return out;
}

/** Control point: chord midpoint pushed along the chord normal by CTRL_OFFSET. */
export function scriptedControl(): readonly [number, number] {
  const mx = (P0[0] + P1[0]) / 2;
  const my = (P0[1] + P1[1]) / 2;
  const dx = P1[0] - P0[0];
  const dy = P1[1] - P0[1];
  const len = Math.hypot(dx, dy) || 1;
  return [mx + (-dy / len) * CTRL_OFFSET, my + (dx / len) * CTRL_OFFSET];
}

/**
 * Deterministic capture/loop meteor: a pure function of the loop phase
 * (phase = tt mod loopPeriod). Returns null outside the flight window
 * (endpoints included) so nothing straddles the seam. The window closes
 * before the black-hole collapse begins; see meteor.test.ts.
 */
export function scriptedMeteor(
  phase: number,
  _loopPeriod: number
): MeteorFrame | null {
  const u = (phase - SPAWN) / DURATION;
  if (u <= 0 || u >= 1) return null;
  const c = scriptedControl();
  const head = meteorPoint(P0, c, P1, u);
  return {
    samples: meteorTail(P0, c, P1, u, TAIL_U),
    headX: head.x,
    headY: head.y,
    alpha: meteorAlpha(u),
  };
}
