import type { Layer, FrameContext } from "./types";
import { centroid, radius } from "../projects";
import { rgba, mixHex } from "../color";
import { snapFreq } from "../loopfreq";

// Glows composite as light ("screen") so the galaxy photo behind shows through
// and they read as luminous haze rather than flat colour decals. The hues are
// deepened (mixed toward black) and the alphas lowered so screen blending stays
// colourful instead of washing to white, and so the clouds don't mush together.
const NEBULA_BLEND: GlobalCompositeOperation = "screen";
const NEBULA_DEEPEN = 0.3; // mix each hue 30% toward black before screening
const NEBULA_ALPHA_CORE = 0.11; // centre stop (was 0.17, source-over)
const NEBULA_ALPHA_MID = 0.045; // mid stop (was 0.07)

/**
 * §2.1 — one soft, breathing two-hue halo per project, drawn under the stars and
 * with NO connecting lines (avoids the v1 eye-strain). Hue is decorative and set
 * in projects.ts; here we just paint, screened over the background so it blends
 * with the galaxy photo. Fades and pulls toward the centre as the black hole
 * sucks (blackHole.suck), matching the nebula-animated mockup.
 */
export class ProjectNebulaLayer implements Layer {
  draw(f: FrameContext): void {
    const { ctx, tt, projects, blackHole, center } = f;
    // ×1.3 fades the nebula out before suck reaches 1, so it's gone before the
    // singularity flash rather than lingering under it.
    const regAlpha = Math.max(0, 1 - blackHole.suck * 1.3);
    if (regAlpha <= 0.01) return;

    // In loop/capture mode, snap the breathing + blob-rotation frequencies to
    // harmonics of the loop period so they return to phase at the seam.
    const breatheFreq = f.loopPeriod ? snapFreq(0.6, f.loopPeriod) : 0.6;
    const angFreq = f.loopPeriod ? snapFreq(0.25, f.loopPeriod) : 0.25;

    ctx.save();
    ctx.globalCompositeOperation = NEBULA_BLEND;
    projects.forEach((p, pi) => {
      if (p.members.length === 0) return;
      const c = centroid(p);
      // Pull the halo toward the singularity as suck rises.
      const cx = c.x + (center.x - c.x) * blackHole.suck;
      const cy = c.y + (center.y - c.y) * blackHole.suck;

      const breathe = 1 + 0.08 * Math.sin(tt * breatheFreq + pi * 1.7);
      // radius() uses the UN-pulled centroid (c), not the pulled (cx,cy), so the
      // halo size stays tied to the star cluster's true spread even as it drifts
      // toward the singularity. Do not change to radius(p, cx, cy).
      const rad = (radius(p, c.x, c.y) + 40) * (1 - blackHole.suck * 0.6) * breathe;

      const hues = [p.hueA, p.hueB];
      for (let k = 0; k < 2; k++) {
        // Deepen the hue so screen blending adds *coloured* light, not white.
        const hue = mixHex(hues[k], "#000000", NEBULA_DEEPEN);
        const ang = tt * angFreq + pi * 2 + k * Math.PI;
        const off = rad * 0.22;
        const bx = cx + Math.cos(ang) * off;
        const by = cy + Math.sin(ang) * off;
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        rg.addColorStop(0, rgba(hue, NEBULA_ALPHA_CORE * regAlpha));
        rg.addColorStop(0.55, rgba(hue, NEBULA_ALPHA_MID * regAlpha));
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, 6.283);
        ctx.fill();
      }
    });
    ctx.restore();
  }
}
