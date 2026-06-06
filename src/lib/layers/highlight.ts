import type { Layer, FrameContext } from "./types";
import type { ProjectGroup } from "../projects";
import { rgba } from "../color";

/** Draws a smooth quadratic curve through a group's members. */
function smoothCurve(ctx: CanvasRenderingContext2D, g: ProjectGroup): void {
  const pts = g.members;
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const c = pts[i];
    const n = pts[i + 1];
    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

/**
 * §2.2 — progressive disclosure on hover. The hovered project (f.hover.project)
 * eases its `hl` toward 1; a smooth glowing curve, member rings, and a label
 * appear. Coexists with the single-star HoverRing/tooltip. The orchestrator
 * nulls hover during black-hole activity, so this auto-pauses then.
 */
export class ProjectHighlightLayer implements Layer {
  draw(f: FrameContext): void {
    const { ctx, projects, hover } = f;

    // Ease every project's highlight state.
    for (const p of projects) {
      const target = p === hover.project ? 1 : 0;
      p.hl += (target - p.hl) * 0.18;
    }

    for (const p of projects) {
      if (p.hl < 0.02 || p.members.length === 0) continue;
      const a = p.hl;

      ctx.save();
      ctx.shadowColor = rgba(p.hueA, 0.8 * a);
      ctx.shadowBlur = 10 * a;
      ctx.strokeStyle = rgba(p.hueA, 0.75 * a);
      ctx.lineWidth = 1.6;
      smoothCurve(ctx, p);
      ctx.restore();

      for (const m of p.members) {
        ctx.strokeStyle = rgba(p.hueB, 0.6 * a);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 6, 0, 6.283);
        ctx.stroke();
      }

      let best = p.members[0];
      for (const m of p.members) if (m.day.count > best.day.count) best = m;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#fff";
      ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("✦ " + p.name, best.x + 10, best.y - 9);
      ctx.globalAlpha = 1;
    }
  }
}
