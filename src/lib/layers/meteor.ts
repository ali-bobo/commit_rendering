import type { Layer, FrameContext } from "./types";
import { mixHex, rgba } from "../color";
import {
  meteorTail,
  meteorAlpha,
  scriptedMeteor,
  type MeteorFrame,
  type MeteorSample,
} from "../meteor";

// Head glow: near-white core with a soft halo (astrophoto-style bloom).
const HEAD_CORE_COLOR = "#fffaf4";
const HEAD_CORE_R = 1.6; // px
const HEAD_HALO_R = 7; // px
// Tail colour ramps warm: near-white at the head to ember orange at the tip.
const TAIL_COLOR_HEAD = "#fff3e8";
const TAIL_COLOR_TIP = "#ffb08a";

const LIVE_LIFE_RATE = 0.5; // life units per second (2s flight, as before)
const LIVE_TAIL_LEN = 16; // trail reach in velocity units (matches the old look's scale)

interface LiveMeteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/** Draw one meteor frame whose samples/head are already in px. */
function drawFrame(ctx: CanvasRenderingContext2D, fr: MeteorFrame): void {
  if (fr.alpha <= 0) return;
  const s = fr.samples;
  // Tapered tail: per-segment strokes, because a single stroke cannot grade
  // width, colour, and alpha along its length.
  ctx.lineCap = "round";
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    const k = (i - 0.5) / (s.length - 1); // segment midpoint 0..1 along tail
    const segA = ((a.a + b.a) / 2) * fr.alpha;
    if (segA <= 0.002) continue;
    ctx.strokeStyle = rgba(mixHex(TAIL_COLOR_HEAD, TAIL_COLOR_TIP, k), segA);
    ctx.lineWidth = (a.w + b.w) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // Head: small bright core inside a soft halo, drawn over the tail.
  const g = ctx.createRadialGradient(fr.headX, fr.headY, 0, fr.headX, fr.headY, HEAD_HALO_R);
  g.addColorStop(0, rgba(HEAD_CORE_COLOR, fr.alpha));
  g.addColorStop(HEAD_CORE_R / HEAD_HALO_R, rgba(HEAD_CORE_COLOR, 0.85 * fr.alpha));
  g.addColorStop(1, rgba(HEAD_CORE_COLOR, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(fr.headX, fr.headY, HEAD_HALO_R, 0, 6.283);
  ctx.fill();
}

/**
 * Shooting stars.
 *
 * Live site (loopPeriod == null): occasional random meteors, as before —
 * spawning pauses during black-hole activity and under reduced motion, while
 * in-flight meteors always finish their fall. Only the drawing changed
 * (head glow + tapered tail instead of a constant-width line).
 *
 * Capture/loop (loopPeriod != null): NO random simulation. One scripted
 * meteor per loop, a pure function of the loop phase, so the seamless WebP
 * has no seam pop and the static PNG (captured at tt≈0.8s) deliberately
 * catches it crossing the empty upper-right. No Math.random on this branch.
 */
export class MeteorLayer implements Layer {
  private meteors: LiveMeteor[] = [];
  private next = 2;

  draw(f: FrameContext): void {
    const { ctx, W, H, dt, tt, opts, reduceMotion, blackHole, loopPeriod } = f;

    if (loopPeriod != null) {
      // Deterministic loop meteor; honours the same toggles as the live path.
      if (!opts.meteors || reduceMotion) return;
      // Defence in depth: SPAWN+DURATION < calm is asserted by meteor.test.ts,
      // but that test hard-codes the 6.3s action window from renderer.ts. If
      // either constant ever drifts without the other, this guard keeps the
      // meteor from rendering over the black hole (today it never triggers).
      if (blackHole.active) return;
      const fr = scriptedMeteor(tt % loopPeriod, loopPeriod);
      if (!fr) return;
      // Percent space → px (sample widths are already px).
      const toPx = (p: MeteorSample): MeteorSample => ({
        ...p,
        x: (p.x / 100) * W,
        y: (p.y / 100) * H,
      });
      drawFrame(ctx, {
        samples: fr.samples.map(toPx),
        headX: (fr.headX / 100) * W,
        headY: (fr.headY / 100) * H,
        alpha: fr.alpha,
      });
      return;
    }

    const allow = opts.meteors && !reduceMotion && !blackHole.active;
    if (allow) {
      this.next -= dt;
      if (this.next <= 0) {
        this.meteors.push({
          x: Math.random() * W,
          y: -10,
          vx: -(2 + Math.random() * 2),
          vy: 3 + Math.random() * 2,
          life: 1,
        });
        this.next = 2 + Math.random() * 4;
      }
    }
    // In-flight meteors always finish their fall; only spawning pauses (above).
    for (const me of this.meteors) {
      me.x += me.vx * 60 * dt;
      me.y += me.vy * 60 * dt;
      me.life -= dt * LIVE_LIFE_RATE;
      const u = Math.min(1, Math.max(0, 1 - me.life)); // flight progress 0..1
      // The live tail is straight: passing the chord midpoint as the Bézier
      // control point makes meteorTail's quadratic collapse to an exact
      // p0→head lerp (u=1, reach 1). Deliberate: it keeps the width/alpha
      // taper in one place instead of duplicating it here, at the cost of a
      // degenerate curve evaluation. CTRL offsets/curvature never apply.
      const tailX = me.x - me.vx * LIVE_TAIL_LEN;
      const tailY = me.y - me.vy * LIVE_TAIL_LEN;
      const p0: [number, number] = [tailX, tailY];
      const p1: [number, number] = [me.x, me.y];
      const mid: [number, number] = [(tailX + me.x) / 2, (tailY + me.y) / 2];
      drawFrame(ctx, {
        samples: meteorTail(p0, mid, p1, 1, 1),
        headX: me.x,
        headY: me.y,
        alpha: meteorAlpha(u),
      });
    }
    this.meteors = this.meteors.filter((m) => m.life > 0 && m.y < H + 20);
  }
}
