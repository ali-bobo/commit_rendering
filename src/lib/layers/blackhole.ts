import type { Layer, FrameContext } from "./types";
import { rgba, PALETTE } from "../color";

/**
 * §2.3 — the event horizon, drawn on TOP so it always reads as a hole: pure-black
 * core + hot photon rim + three rotating accretion ellipses + outer hot glow,
 * plus the singularity flash during `sing`. Sized by blackHole.eh/hot from the
 * controller. Inactive (calm / disabled / reduced-motion) → eh is 0 → nothing drawn.
 */
export class BlackHoleOverlayLayer implements Layer {
  draw(f: FrameContext): void {
    const { ctx, tt, blackHole: bh, center } = f;
    const { x: cx, y: cy } = center;
    const eh = bh.eh;
    const hot = bh.hot;

    if (eh >= 0.5) {
      // Outer hot glow.
      const og = ctx.createRadialGradient(cx, cy, eh * 0.7, cx, cy, eh * 2.6);
      og.addColorStop(0, rgba("#ffd9c0", 0));
      og.addColorStop(0.45, rgba("#ff9e7a", 0.45 * hot));
      og.addColorStop(0.75, rgba("#d75fc4", 0.22 * hot));
      og.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(cx, cy, eh * 2.6, 0, 6.283);
      ctx.fill();

      // Rotating accretion rings.
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tt * (1.2 + k * 0.5));
        ctx.strokeStyle = rgba(PALETTE[(k + (tt | 0)) % PALETTE.length], 0.5 * hot);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, eh * (1.25 + k * 0.28), eh * (0.5 + k * 0.12), 0, 0.3, 5.6);
        ctx.stroke();
        ctx.restore();
      }

      // Bright photon rim.
      const rim = ctx.createRadialGradient(cx, cy, eh * 0.82, cx, cy, eh * 1.18);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(0.5, rgba("#fff3e6", 0.9 * hot));
      rim.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, eh * 1.18, 0, 6.283);
      ctx.fill();

      // Pure black core.
      ctx.fillStyle = "#020108";
      ctx.beginPath();
      ctx.arc(cx, cy, eh, 0, 6.283);
      ctx.fill();
    }

    // Singularity flash.
    if (bh.phase === "sing") {
      const flash = Math.sin(bh.pp * Math.PI);
      const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.W * 0.55);
      fg.addColorStop(0, rgba("#ffffff", 0.95 * flash));
      fg.addColorStop(0.18, rgba("#ffe6d6", 0.55 * flash));
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, f.W, f.H);
    }
  }
}
