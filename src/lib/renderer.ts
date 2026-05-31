import type { ConstellationData, DayStar } from "./types";

const FALLBACK_COLOR = "#ffc6a0";

export interface RendererOptions {
  drift: number; // 0..1 multiplier
  showProjects: boolean;
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

/**
 * Builds star layout from the data. Stars are grouped into clusters by month,
 * each cluster placed at a stable pseudo-random spot. Colour comes from the
 * day's language.
 */
function buildStars(data: ConstellationData): Star[] {
  const colorByLang = new Map<string, string>();
  for (const l of data.languages) colorByLang.set(l.name, l.color);

  // Group days by month index.
  const byMonth = new Map<number, DayStar[]>();
  for (const day of data.days) {
    const m = new Date(day.date + "T00:00:00").getMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(day);
  }

  const stars: Star[] = [];
  const months = [...byMonth.keys()].sort((a, b) => a - b);
  months.forEach((m, ci) => {
    const rand = seededRand((m + 1) * 131 + 7);
    const cx = 8 + 84 * rand();
    const cy = 12 + 74 * rand();
    const monthDays = byMonth.get(m)!;
    monthDays.forEach((day, i) => {
      const a = rand() * Math.PI * 2;
      const rr = Math.pow(rand(), 0.7) * 10;
      stars.push({
        day,
        bx: cx + Math.cos(a) * rr,
        by: cy + Math.sin(a) * rr,
        x: 0,
        y: 0,
        r: 1.1 + day.count * 0.4,
        twk: rand(),
        tws: 0.6 + rand() * 1.3,
        col: (day.language && colorByLang.get(day.language)) || FALLBACK_COLOR,
        monthLabel: MONTHS[m] ?? `${m + 1}月`,
      });
      void ci;
      void i;
    });
  });
  return stars;
}

export interface HoverInfo {
  x: number;
  y: number;
  count: number;
  date: string;
  language: string | null;
  monthLabel: string;
}

export class ConstellationRenderer {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: ConstellationData;
  private stars: Star[];
  private starByDate: Map<string, Star>;
  private bg: { x: number; y: number; r: number; tw: number }[] = [];
  private meteors: Meteor[] = [];
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
    this.data = data;
    this.opts = opts;
    this.stars = buildStars(data);
    this.starByDate = new Map(this.stars.map((s) => [s.day.date, s]));

    const rand = seededRand(987);
    for (let i = 0; i < 170; i++) {
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

    // Background gradient (warm nebula night).
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1c0f1e");
    grad.addColorStop(0.5, "#2a1220");
    grad.addColorStop(1, "#34161c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Nebula glow blobs.
    const blobRand = seededRand(42);
    for (let k = 0; k < 5; k++) {
      const nx = (0.2 + 0.6 * blobRand()) * W;
      const ny = (0.2 + 0.6 * blobRand()) * H;
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * 0.3);
      const cc = [
        "rgba(255,140,120,0.10)",
        "rgba(255,170,200,0.08)",
        "rgba(255,200,150,0.09)",
      ][k % 3];
      rg.addColorStop(0, cc);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Distant stars.
    for (const s of this.bg) {
      const x = (s.x / 100) * W;
      const y = (s.y / 100) * H;
      ctx.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(this.tt * 1.5 + s.tw * 6.28));
      ctx.fillStyle = "#ffdfd0";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Drift + optional gravity, smoothed.
    const groupRand = seededRand(7);
    const groups = new Map<string, number>();
    for (const s of this.stars) {
      if (!groups.has(s.monthLabel)) groups.set(s.monthLabel, groupRand());
    }
    for (const s of this.stars) {
      const k = groups.get(s.monthLabel)!;
      const ox = Math.sin(this.tt * 0.13 + k * 6.28) * 3.0;
      const oy = Math.cos(this.tt * 0.11 + k * 9.42) * 2.4;
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

    // Faint month-cluster lines.
    ctx.lineWidth = 0.5;
    const byMonth = new Map<string, Star[]>();
    for (const s of this.stars) {
      if (!byMonth.has(s.monthLabel)) byMonth.set(s.monthLabel, []);
      byMonth.get(s.monthLabel)!.push(s);
    }
    for (const arr of byMonth.values()) {
      const sorted = [...arr].sort((a, b) => b.day.count - a.day.count).slice(0, 6);
      for (let i = 0; i < sorted.length - 1; i++) {
        ctx.strokeStyle = "rgba(255,190,170,0.14)";
        ctx.beginPath();
        ctx.moveTo(sorted[i].x, sorted[i].y);
        ctx.lineTo(sorted[i + 1].x, sorted[i + 1].y);
        ctx.stroke();
      }
    }

    // Named project constellations.
    if (this.opts.showProjects) {
      for (const proj of this.data.projects) {
        const pts = proj.starDates
          .map((d) => this.starByDate.get(d))
          .filter((s): s is Star => !!s);
        if (pts.length < 2) continue;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,215,190,0.5)";
        ctx.beginPath();
        pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
        ctx.stroke();
        const cxm = pts.reduce((p, s) => p + s.x, 0) / pts.length;
        const cym = pts.reduce((p, s) => p + s.y, 0) / pts.length;
        ctx.fillStyle = "rgba(255,225,205,0.78)";
        ctx.font = 'italic 12px Georgia, serif';
        ctx.textAlign = "center";
        ctx.fillText("✦ " + proj.name, cxm, cym - 14);
      }
    }

    // Stars + hover detection.
    let hit: Star | null = null;
    let hd = 14;
    for (const s of this.stars) {
      if (s.day.count === 0) continue;
      const tw = 0.7 + 0.3 * Math.sin(this.tt * s.tws * 2 + s.twk * 6.28);
      const R = s.r * tw;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * 4.5);
      g.addColorStop(0, s.col);
      g.addColorStop(0.3, s.col + "99");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.6 * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R * 4.5, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.8, R * 0.5), 0, 6.283);
      ctx.fill();
      ctx.fillStyle = s.col;
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

    // Hover ring + report.
    if (hit) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, hit.r + 5, 0, 6.283);
      ctx.stroke();
      ctx.globalAlpha = 1;
      this.onHover?.({
        x: hit.x,
        y: hit.y,
        count: hit.day.count,
        date: hit.day.date,
        language: hit.day.language,
        monthLabel: hit.monthLabel,
      });
    } else {
      this.onHover?.(null);
    }
  }
}
