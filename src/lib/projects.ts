import type { ConstellationData } from "./types.ts";
import type { Star } from "./layout.ts";
import { accentColor } from "./color.ts";

export interface ProjectGroup {
  name: string;
  /** Member stars (those whose date is in the project's starDates), sorted by t. */
  members: Star[];
  /** Mean arc-progress of the members; drives warm→cool hue placement. */
  meanT: number;
  /** Dominant decorative hue (interleaves warm/cool across adjacent projects). */
  hueA: string;
  /** Secondary hue for the two-blob multi-colour nebula. */
  hueB: string;
  /** Highlight ease state 0..1, mutated by the highlight layer on hover. */
  hl: number;
}

/**
 * Groups the data's projects into renderable constellations and assigns each a
 * decorative two-hue pair. Hue is positional (by meanT along the arc) and
 * interleaved so adjacent projects never share a dominant hue — this is the
 * "多色交錯" look. Hue is purely decorative and does NOT touch the data contract.
 */
export function buildProjectGroups(
  data: ConstellationData,
  stars: Star[]
): ProjectGroup[] {
  const byDate = new Map<string, Star>();
  for (const s of stars) byDate.set(s.day.date, s);

  const groups: ProjectGroup[] = data.projects.map((p) => {
    const members = p.starDates
      .map((d) => byDate.get(d))
      .filter((s): s is Star => s !== undefined)
      .sort((a, b) => a.t - b.t);
    const meanT = members.length
      ? members.reduce((sum, s) => sum + s.t, 0) / members.length
      : 0.5;
    return { name: p.name, members, meanT, hueA: "", hueB: "", hl: 0 };
  });

  // Walk the projects warm→cool by arc position; even ranks lead warm, odd lead
  // cool, so neighbours always differ in dominant hue.
  const order = [...groups].sort((a, b) => a.meanT - b.meanT);
  const n = order.length;
  order.forEach((g, i) => {
    const u = n > 1 ? i / (n - 1) : 0.5;
    const warm = accentColor(u * 0.5); // lower (warm) half of the ramp
    const cool = accentColor(0.5 + u * 0.5); // upper (cool) half
    if (i % 2 === 0) {
      g.hueA = warm;
      g.hueB = cool;
    } else {
      g.hueA = cool;
      g.hueB = warm;
    }
  });

  return groups;
}

/** Live centroid (px) of a group's member stars. */
export function centroid(g: ProjectGroup): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const m of g.members) {
    cx += m.x;
    cy += m.y;
  }
  const n = g.members.length || 1;
  return { x: cx / n, y: cy / n };
}

/** Furthest member distance from a given centre (px). */
export function radius(g: ProjectGroup, cx: number, cy: number): number {
  let r = 0;
  for (const m of g.members) r = Math.max(r, Math.hypot(m.x - cx, m.y - cy));
  return r;
}
