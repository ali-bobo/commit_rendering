// Fallback star colour for unknown languages. Sits in the harmonious
// coral→indigo ramp so it never clashes with the legend palette.
export const FALLBACK_COLOR = "#d79ad0";

// Accent ramp (coral→indigo) used to tint each star's glow and to colour the
// project nebulae. The star body keeps its language colour; this ramp sprinkles
// the rest of the palette into the scene by position.
export const ACCENT_ANCHORS = ["#ff9e7a", "#ff6f9c", "#d75fc4", "#9b6cff", "#6c7bff"];

// The decorative nebula palette (warm→cool). Mirrors the accent anchors; kept as
// a named export so the project-nebula hue assignment reads clearly.
export const PALETTE = ["#ff9e7a", "#ff6f9c", "#d75fc4", "#9b6cff", "#6c7bff"];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear RGB blend of two hex colours; t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Sample the accent ramp at u in [0,1] (clamped). */
export function accentColor(u: number): string {
  const c = Math.max(0, Math.min(1, u));
  const seg = c * (ACCENT_ANCHORS.length - 1);
  const i = Math.min(ACCENT_ANCHORS.length - 2, Math.floor(seg));
  return mixHex(ACCENT_ANCHORS[i], ACCENT_ANCHORS[i + 1], seg - i);
}

/** Build an rgba() string from a hex colour and an alpha. */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
