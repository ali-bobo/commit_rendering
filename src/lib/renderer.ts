import type { ConstellationData } from "./types";
import { arcPoint, arcNormal } from "./arc";
import { accentColor, mixHex } from "./color";
import { type Star, type MonthAnchor, buildStars, buildMonthAnchors } from "./layout";

export interface RendererOptions {
  drift: number; // 0..1 multiplier
  gravity: boolean;
  meteors: boolean;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 99.7) * 43758.5453;
    return s - Math.floor(s);
  };
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
  private monthAnchors: MonthAnchor[];
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
