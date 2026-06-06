/** Galaxy-arm geometry: a single cubic Bézier in percent space (0..100). */
export interface Pt {
  x: number;
  y: number;
}

// The "galaxy arm": Jan at the lower-left end (t=0), Dec at the upper-right
// (t=1). Days flow along it by date, so the layout reads chronologically AND
// curves like a real spiral arm.
export const ARC: [Pt, Pt, Pt, Pt] = [
  { x: 8, y: 80 },
  { x: 30, y: 80 },
  { x: 60, y: 36 },
  { x: 92, y: 26 },
];

export function arcPoint(t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * ARC[0].x + b * ARC[1].x + c * ARC[2].x + d * ARC[3].x,
    y: a * ARC[0].y + b * ARC[1].y + c * ARC[2].y + d * ARC[3].y,
  };
}

export function arcTangent(t: number): Pt {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  return {
    x: a * (ARC[1].x - ARC[0].x) + b * (ARC[2].x - ARC[1].x) + c * (ARC[3].x - ARC[2].x),
    y: a * (ARC[1].y - ARC[0].y) + b * (ARC[2].y - ARC[1].y) + c * (ARC[3].y - ARC[2].y),
  };
}

/** Unit normal pointing toward the "outer" (upper) side of the arc. */
export function arcNormal(t: number): Pt {
  const tan = arcTangent(t);
  const len = Math.hypot(tan.x, tan.y) || 1;
  let nx = -tan.y / len;
  let ny = tan.x / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}
