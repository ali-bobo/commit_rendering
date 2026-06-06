import type { Layer, FrameContext } from "./types";
import { accentColor, mixHex, rgba } from "../color";

/**
 * Draws each lit star: a language-led glow with a light positional accent, a
 * white core, and a coloured body. Position is already resolved by the
 * orchestrator (drift + optional black-hole transform); swallowed stars are
 * skipped. A tail is drawn when the black hole is pulling.
 */
export class StarfieldLayer implements Layer {
  private litTMin: number;
  private litTMax: number;

  constructor(litTMin: number, litTMax: number) {
    this.litTMin = litTMin;
    this.litTMax = litTMax;
  }

  draw(f: FrameContext): void {
    const { ctx, tt, stars, blackHole } = f;
    const span = this.litTMax - this.litTMin;

    for (const s of stars) {
      if (s.day.count === 0 || s.swallowed) continue;
      const tw = 0.7 + 0.3 * Math.sin(tt * s.tws * 2 + s.twk * 6.28);
      const R = s.r * tw;
      const bright = 0.5 + Math.min(0.45, Math.log1p(s.day.count) * 0.16);
      const accentT = span > 1e-6 ? (s.t - this.litTMin) / span : 0.5;
      const accent = accentColor(accentT);
      const glowCol = mixHex(s.col, accent, 0.3);
      const bodyCol = mixHex(
        mixHex(s.col, accent, 0.22),
        "#ffffff",
        Math.max(0, 0.3 - Math.log1p(s.day.count) * 0.11)
      );

      // Motion-blur tail while the black hole pulls.
      if (blackHole.tail > 0.005) {
        const len = (12 + R * 6) * blackHole.tail;
        const dx = s.x - f.center.x;
        const dy = s.y - f.center.y;
        const d = Math.hypot(dx, dy) || 1;
        const tx = s.x + (dx / d) * len;
        const ty = s.y + (dy / d) * len;
        const tg = ctx.createLinearGradient(tx, ty, s.x, s.y);
        tg.addColorStop(0, rgba(s.col, 0));
        tg.addColorStop(1, rgba(s.col, 0.6));
        ctx.strokeStyle = tg;
        ctx.lineWidth = Math.max(1, R * 0.9);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.lineCap = "butt"; // restore default so later layers (meteors/hover) keep butt caps
      }

      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * 4.5);
      g.addColorStop(0, glowCol);
      g.addColorStop(0.3, glowCol + "99");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = bright * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R * 4.5, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.8, R * 0.55), 0, 6.283);
      ctx.fill();
      ctx.fillStyle = bodyCol;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
