import type { ConstellationData, DayStar } from "./types";
import { normalizedRadius } from "./starfield";
import { arcPoint, arcTangent, arcNormal } from "./arc";

// Fallback star colour for unknown languages. Sits in the harmonious
// coral→indigo ramp so it never clashes with the legend palette.
const FALLBACK_COLOR = "#d79ad0";

export interface RendererOptions {
  drift: number; // 0..1 multiplier
  gravity: boolean;
  meteors: boolean;
}

interface Star {
  day: DayStar;
  bx: number; // base position 0..100 (percent of canvas)
  by: number;
  x: number; // live pixel position
  y: number;
  r: number; // base radius from magnitude
  t: number; // 0..1 progress along the year arc (drives drift phase + ordering)
  twk: number; // twinkle phase
  tws: number; // twinkle speed
  col: string;
  monthLabel: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 99.7) * 43758.5453;
    return s - Math.floor(s);
  };
}

/** Stable hash of an ISO date so a day's jitter never changes between renders. */
function hashDate(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Accent ramp (coral→indigo) used to tint each star's glow. The star body keeps
// its language colour, so the glow sprinkles the rest of the palette into the
// scene without losing the language→colour meaning — handy when one language
// dominates and every body would otherwise be the same hue.
const ACCENT_ANCHORS = ["#ff9e7a", "#ff6f9c", "#d75fc4", "#9b6cff", "#6c7bff"];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear RGB blend of two hex colours; t=0 → a, t=1 → b. */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Sample the accent ramp at u in [0,1]. */
function accentColor(u: number): string {
  const c = Math.max(0, Math.min(1, u));
  const seg = c * (ACCENT_ANCHORS.length - 1);
  const i = Math.min(ACCENT_ANCHORS.length - 2, Math.floor(seg));
  return mixHex(ACCENT_ANCHORS[i], ACCENT_ANCHORS[i + 1], seg - i);
}

/**
 * Builds star layout from the data. Each day is placed along the year arc by its
 * date (oldest→newest = t 0→1), with a small seeded perpendicular jitter so the
 * arm reads as a star cloud rather than a hard line. Returned in date order,
 * which the time-thread relies on.
 */
function buildStars(data: ConstellationData): Star[] {
  const colorByLang = new Map<string, string>();
  for (const l of data.languages) colorByLang.set(l.name, l.color);

  const N = data.days.length;
  // Radius is normalized to the user's OWN busiest day, so a sparse portfolio
  // account still gets a prominent "hero" star instead of a field of uniform
  // specks (see starfield.normalizedRadius).
  const maxCount = data.days.reduce((m, d) => Math.max(m, d.count), 0);
  const stars: Star[] = [];
  data.days.forEach((day, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const base = arcPoint(t);
    const norm = arcNormal(t);
    const tan = arcTangent(t);
    const tlen = Math.hypot(tan.x, tan.y) || 1;
    const rand = seededRand(hashDate(day.date));
    // Perpendicular spread forms the band; a little along-arc jitter loosens it.
    const jN = (rand() * 2 - 1) * 9.5;
    const jT = (rand() * 2 - 1) * 2.5;
    stars.push({
      day,
      bx: base.x + norm.x * jN + (tan.x / tlen) * jT,
      by: base.y + norm.y * jN + (tan.y / tlen) * jT,
      x: 0,
      y: 0,
      r: normalizedRadius(day.count, maxCount),
      t,
      twk: rand(),
      tws: 0.6 + rand() * 1.3,
      col: (day.language && colorByLang.get(day.language)) || FALLBACK_COLOR,
      monthLabel: MONTHS[new Date(day.date + "T00:00:00").getMonth()] ?? "",
    });
  });
  return stars;
}

/** Where each present month sits along the arc (mean t of its days). */
function buildMonthAnchors(data: ConstellationData): { label: string; t: number }[] {
  const N = data.days.length;
  const acc = new Map<number, { sum: number; n: number }>();
  data.days.forEach((day, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const m = new Date(day.date + "T00:00:00").getMonth();
    const e = acc.get(m) ?? { sum: 0, n: 0 };
    e.sum += t;
    e.n += 1;
    acc.set(m, e);
  });
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, e]) => ({ label: MONTHS[m] ?? `${m + 1}月`, t: e.sum / e.n }));
}

export interface HoverInfo {
  x: number;
  y: number;
  count: number;
  date: string;
  language: string | null;
  monthLabel: string;
  projectName?: string;
}

// Warm→cool nebula blobs, fixed so colour grades with position: coral/rose at
// the arc's lower-left start, violet/indigo toward its upper-right end.
const NEBULA_BLOBS: { x: number; y: number; c: string }[] = [
  { x: 14, y: 82, c: "rgba(255,140,120,0.11)" },
  { x: 30, y: 70, c: "rgba(255,120,165,0.10)" },
  { x: 46, y: 78, c: "rgba(230,110,185,0.08)" },
  { x: 55, y: 46, c: "rgba(200,110,222,0.08)" },
  { x: 70, y: 36, c: "rgba(160,110,255,0.08)" },
  { x: 85, y: 26, c: "rgba(120,130,255,0.07)" },
  { x: 62, y: 60, c: "rgba(255,150,150,0.06)" },
];

export class ConstellationRenderer {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[];
  private monthAnchors: { label: string; t: number }[];
  // Arc-progress span of the *active* days, so the glow accent ramp stretches
  // across whatever window the user actually committed in (not the whole year).
  private litTMin = 0;
  private litTMax = 1;
  private bg: { x: number; y: number; r: number; tw: number }[] = [];
  private meteors: Meteor[] = [];
  private dateToProject: Map<string, string> = new Map();
  private opts: RendererOptions;
  private W = 0;
  private H = 0;
  private DPR = 1;
  private tt = 0;
  private last = performance.now();
  private mx = -99;
  private my = -99;
  private nextMeteor = 2;
  private raf = 0;
  private reduceMotion = false;
  public onHover: ((info: HoverInfo | null) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    data: ConstellationData,
    opts: RendererOptions
  ) {
    this.cv = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.opts = opts;
    this.stars = buildStars(data);
    this.monthAnchors = buildMonthAnchors(data);

    const litTs = this.stars.filter((s) => s.day.count > 0).map((s) => s.t);
    if (litTs.length) {
      this.litTMin = Math.min(...litTs);
      this.litTMax = Math.max(...litTs);
    }

    // Build date → project name lookup for hover display.
    for (const proj of data.projects) {
      for (const date of proj.starDates) {
        this.dateToProject.set(date, proj.name);
      }
    }

    const rand = seededRand(987);
    for (let i = 0; i < 220; i++) {
      this.bg.push({
        x: rand() * 100,
        y: rand() * 100,
        r: rand() * 0.9 + 0.2,
        tw: rand(),
      });
    }

    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    this.resize();
  }

  setOptions(opts: Partial<RendererOptions>) {
    this.opts = { ...this.opts, ...opts };
  }

  setPointer(x: number, y: number) {
    this.mx = x;
    this.my = y;
  }

  clearPointer() {
    this.mx = -99;
    this.my = -99;
  }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth;
    this.H = this.cv.clientHeight;
    this.cv.width = this.W * this.DPR;
    this.cv.height = this.H * this.DPR;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private spawnMeteor() {
    this.meteors.push({
      x: Math.random() * this.W,
      y: -10,
      vx: -(2 + Math.random() * 2),
      vy: 3 + Math.random() * 2,
      life: 1,
    });
  }

  private frame(now: number) {
    const { ctx, W, H } = this;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const driftMul = this.reduceMotion ? 0 : this.opts.drift;
    this.tt += dt * driftMul;

    // Background gradient (deep plum → indigo, matching the nebula ramp).
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1d1026");
    grad.addColorStop(0.5, "#1a1030");
    grad.addColorStop(1, "#141228");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Nebula glow blobs — warm at the arc start, cool toward its end.
    for (const b of NEBULA_BLOBS) {
      const nx = (b.x / 100) * W;
      const ny = (b.y / 100) * H;
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * 0.3);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Distant stars.
    for (const s of this.bg) {
      const x = (s.x / 100) * W;
      const y = (s.y / 100) * H;
      ctx.globalAlpha =
        0.2 + 0.5 * (0.5 + 0.5 * Math.sin(this.tt * 1.5 + s.tw * 6.28));
      ctx.fillStyle = "#f3e9ff";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Drift (gentle per-star sway keyed to arc position) + optional gravity.
    for (const s of this.stars) {
      const ph = s.t * 6.28 * 2;
      const ox = Math.sin(this.tt * 0.5 + ph) * 1.5;
      const oy = Math.cos(this.tt * 0.42 + ph) * 1.2;
      let tx = ((s.bx + ox) / 100) * W;
      let ty = ((s.by + oy) / 100) * H;
      if (this.opts.gravity && this.mx > 0) {
        const dx = this.mx - tx;
        const dy = this.my - ty;
        const d = Math.hypot(dx, dy);
        if (d < 120) {
          const f = (1 - d / 120) * 0.4;
          tx += dx * f;
          ty += dy * f;
        }
      }
      s.x += (tx - s.x) * 0.12;
      s.y += (ty - s.y) * 0.12;
    }

    // Month labels, anchored on the outer side of the arc.
    ctx.fillStyle = "rgba(230,210,255,0.26)";
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const a of this.monthAnchors) {
      const p = arcPoint(a.t);
      const n = arcNormal(a.t);
      const lx = ((p.x + n.x * 7) / 100) * W;
      const ly = ((p.y + n.y * 7) / 100) * H;
      ctx.fillText(a.label, lx, ly);
    }

    // Stars + hover detection. Glow size and brightness scale with the day's
    // commit count, so busy days read as bright, dominant stars.
    let hit: Star | null = null;
    let hd = 14;
    for (const s of this.stars) {
      if (s.day.count === 0) continue;
      const tw = 0.7 + 0.3 * Math.sin(this.tt * s.tws * 2 + s.twk * 6.28);
      const R = s.r * tw;
      const bright = 0.5 + Math.min(0.45, Math.log1p(s.day.count) * 0.16);
      // Glow stays language-led with only a light position-accent tint, so the
      // language→colour meaning reads clearly instead of being washed toward the
      // ramp. (Was 0.6 — that drowned the language hue, which is the colour the
      // legend promises.)
      const span = this.litTMax - this.litTMin;
      const accentT = span > 1e-6 ? (s.t - this.litTMin) / span : 0.5;
      const accent = accentColor(accentT);
      const glowCol = mixHex(s.col, accent, 0.3);
      // Body stays language-led but picks up a touch of the accent, then pales
      // on quiet days so commit volume reads as depth.
      const bodyCol = mixHex(
        mixHex(s.col, accent, 0.22),
        "#ffffff",
        Math.max(0, 0.3 - Math.log1p(s.day.count) * 0.11)
      );
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
      const d = Math.hypot(this.mx - s.x, this.my - s.y);
      if (d < hd) {
        hd = d;
        hit = s;
      }
    }

    // Meteors.
    if (this.opts.meteors && !this.reduceMotion) {
      this.nextMeteor -= dt;
      if (this.nextMeteor <= 0) {
        this.spawnMeteor();
        this.nextMeteor = 2 + Math.random() * 4;
      }
    }
    for (const me of this.meteors) {
      me.x += me.vx * 60 * dt;
      me.y += me.vy * 60 * dt;
      me.life -= dt * 0.5;
      const tg = ctx.createLinearGradient(
        me.x,
        me.y,
        me.x - me.vx * 16,
        me.y - me.vy * 16
      );
      tg.addColorStop(0, `rgba(255,235,220,${Math.max(0, me.life)})`);
      tg.addColorStop(1, "rgba(255,235,220,0)");
      ctx.strokeStyle = tg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(me.x - me.vx * 16, me.y - me.vy * 16);
      ctx.stroke();
    }
    this.meteors = this.meteors.filter((m) => m.life > 0 && m.y < H + 20);

    // Hover ring + cross spikes + report.
    if (hit) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, hit.r + 5, 0, 6.283);
      ctx.stroke();
      // Four-point spike cross.
      const spikeLen = Math.max(12, hit.r * 4);
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "#ffe8df";
      for (let k = 0; k < 4; k++) {
        const angle = (k * Math.PI) / 2;
        const innerR = hit.r + 4;
        ctx.beginPath();
        ctx.moveTo(
          hit.x + Math.cos(angle) * innerR,
          hit.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
          hit.x + Math.cos(angle) * (innerR + spikeLen),
          hit.y + Math.sin(angle) * (innerR + spikeLen)
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      this.onHover?.({
        x: hit.x,
        y: hit.y,
        count: hit.day.count,
        date: hit.day.date,
        language: hit.day.language,
        monthLabel: hit.monthLabel,
        projectName: this.dateToProject.get(hit.day.date),
      });
    } else {
      this.onHover?.(null);
    }
  }
}
