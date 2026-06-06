import type { Layer, FrameContext } from "./types";

/** The existing single-star hover affordance: white ring + four-point spikes. */
export class HoverRingLayer implements Layer {
  draw(f: FrameContext): void {
    const hit = f.hover.star;
    if (!hit || f.blackHole.active) return;
    const { ctx } = f;

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, hit.r + 5, 0, 6.283);
    ctx.stroke();

    const spikeLen = Math.max(12, hit.r * 4);
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#ffe8df";
    for (let k = 0; k < 4; k++) {
      const angle = (k * Math.PI) / 2;
      const innerR = hit.r + 4;
      ctx.beginPath();
      ctx.moveTo(hit.x + Math.cos(angle) * innerR, hit.y + Math.sin(angle) * innerR);
      ctx.lineTo(
        hit.x + Math.cos(angle) * (innerR + spikeLen),
        hit.y + Math.sin(angle) * (innerR + spikeLen)
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
