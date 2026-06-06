import type { ConstellationData } from "./types";
import {
  type Star,
  type MonthAnchor,
  buildStars,
  buildMonthAnchors,
  driftPos,
} from "./layout";
import { buildProjectGroups, type ProjectGroup } from "./projects";
import { arcPoint, arcNormal } from "./arc";
import { BlackHoleController, type PhaseState } from "./blackhole";
import type { FrameContext, Layer, HoverState } from "./layers/types";
import { BackgroundLayer } from "./layers/background";
import { ProjectNebulaLayer } from "./layers/nebula";
import { StarfieldLayer } from "./layers/starfield";
import { ProjectHighlightLayer } from "./layers/highlight";
import { MeteorLayer } from "./layers/meteor";
import { HoverRingLayer } from "./layers/hoverRing";
import { BlackHoleOverlayLayer } from "./layers/blackhole";
import type { RendererOptions } from "./renderer-options";
export type { RendererOptions };

export interface HoverInfo {
  x: number;
  y: number;
  count: number;
  date: string;
  language: string | null;
  monthLabel: string;
  projectName?: string;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 99.7) * 43758.5453;
    return s - Math.floor(s);
  };
}

const STAR_HIT = 14; // px, single-star hover threshold
const PROJECT_HIT = 46; // px, project-level hover threshold

export class ConstellationRenderer {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[];
  private projects: ProjectGroup[];
  private monthAnchors: MonthAnchor[];
  private dateToProject: Map<string, string> = new Map();
  private bh: BlackHoleController;
  private layers: Layer[];
  private opts: RendererOptions;
  private W = 0;
  private H = 0;
  private DPR = 1;
  private tt = 0;
  private last = performance.now();
  private mx = -99;
  private my = -99;
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
    this.projects = buildProjectGroups(data, this.stars);
    this.monthAnchors = buildMonthAnchors(data);

    const litTs = this.stars.filter((s) => s.day.count > 0).map((s) => s.t);
    const litTMin = litTs.length ? Math.min(...litTs) : 0;
    const litTMax = litTs.length ? Math.max(...litTs) : 1;

    for (const proj of data.projects) {
      for (const date of proj.starDates) this.dateToProject.set(date, proj.name);
    }

    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const loop = opts.loopPeriod;
    this.bh =
      loop != null
        ? new BlackHoleController(
            {
              calm: Math.max(0.5, loop - 6.3),
              collapse: 3.2,
              sing: 0.7,
              rebirth: 2.4,
              ehMax: 30,
              swirl: 10,
            },
            !this.reduceMotion
          )
        : new BlackHoleController(undefined, opts.blackHole && !this.reduceMotion);

    this.layers = [
      new BackgroundLayer(
        seededRand(987),
        `${import.meta.env.BASE_URL}bg-galaxy.webp`
      ),
      new ProjectNebulaLayer(),
      new StarfieldLayer(litTMin, litTMax),
      new ProjectHighlightLayer(),
      new MeteorLayer(),
      new HoverRingLayer(),
      new BlackHoleOverlayLayer(),
    ];

    this.resize();

    // Year-switch / initial fly-in: start all stars at the canvas centre so the
    // lerp in updatePositions fans them out to arc positions over ~1s. Disabled
    // for reduced-motion: stars snap straight to their computed positions instead.
    const cx = this.W * 0.5;
    const cy = this.H * 0.46;
    for (const s of this.stars) {
      if (this.reduceMotion) {
        s.x = (s.bx / 100) * this.W;
        s.y = (s.by / 100) * this.H;
      } else {
        s.x = cx;
        s.y = cy;
      }
    }
  }

  setOptions(opts: Partial<RendererOptions>) {
    this.opts = { ...this.opts, ...opts };
    // The black hole is on when EITHER the live toggle is set OR we're in loop/
    // capture mode (loopPeriod != null). Capture passes blackHole:false, so this
    // must not key off blackHole alone — otherwise it would disable the loop.
    if (opts.blackHole !== undefined || opts.loopPeriod !== undefined) {
      this.bh.setEnabled(
        (this.opts.blackHole || this.opts.loopPeriod != null) &&
          !this.reduceMotion
      );
    }
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

  private updatePositions(bhState: PhaseState, center: { x: number; y: number }) {
    const { W, H } = this;
    // Drift speed is already encoded in this.tt (advanced by dt*driftMul in
    // frame()); driftPos uses full sway amplitude exactly like the pre-refactor
    // code, so this preserves visual parity. Do NOT re-scale by driftMul here.
    for (const s of this.stars) {
      const d = driftPos(s, this.tt, this.opts.loopPeriod);
      let tx = (d.x / 100) * W;
      let ty = (d.y / 100) * H;
      if (this.opts.gravity && this.mx > 0 && !bhState.active) {
        const dx = this.mx - tx;
        const dy = this.my - ty;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          const fr = (1 - dist / 120) * 0.4;
          tx += dx * fr;
          ty += dy * fr;
        }
      }
      if (bhState.active) {
        const tr = this.bh.transform(
          { x: tx, y: ty },
          bhState,
          center.x,
          center.y,
          s.spin
        );
        s.x = tr.x;
        s.y = tr.y;
        s.swallowed = tr.swallowed;
      } else {
        s.x += (tx - s.x) * 0.12;
        s.y += (ty - s.y) * 0.12;
        s.swallowed = false;
      }
    }
  }

  private computeHover(active: boolean): HoverState {
    if (active || this.mx <= 0) return { project: null, star: null };
    let star: Star | null = null;
    let sd = STAR_HIT;
    for (const s of this.stars) {
      if (s.day.count === 0) continue;
      const d = Math.hypot(this.mx - s.x, this.my - s.y);
      if (d < sd) {
        sd = d;
        star = s;
      }
    }
    let project: ProjectGroup | null = null;
    let pd = PROJECT_HIT;
    for (const p of this.projects) {
      for (const m of p.members) {
        const d = Math.hypot(this.mx - m.x, this.my - m.y);
        if (d < pd) {
          pd = d;
          project = p;
        }
      }
    }
    return { project, star };
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const driftMul = this.reduceMotion ? 0 : this.opts.drift;
    // Loop/capture mode advances tt in real time (ignores drift) so the cycle
    // length is predictable and equals the recording window.
    this.tt += this.opts.loopPeriod != null ? dt : dt * driftMul;

    const center = { x: this.W * 0.5, y: this.H * 0.46 };
    const bhState = this.bh.state(this.tt);
    this.updatePositions(bhState, center);
    const hover = this.computeHover(bhState.active);

    const { ctx, W, H } = this;
    const f: FrameContext = {
      ctx,
      W,
      H,
      tt: this.tt,
      dt,
      pointer: this.mx > 0 ? { x: this.mx, y: this.my } : null,
      reduceMotion: this.reduceMotion,
      opts: this.opts,
      stars: this.stars,
      projects: this.projects,
      monthAnchors: this.monthAnchors,
      blackHole: bhState,
      hover,
      center,
      loopPeriod: this.opts.loopPeriod,
    };

    this.layers[0].draw(f); // background

    // Month labels on the outer side of the arc (fade as the black hole pulls).
    ctx.globalAlpha = Math.max(0, 1 - bhState.suck * 1.3);
    ctx.fillStyle = "rgba(230,210,255,0.35)";
    ctx.font = "9px ui-monospace, 'SF Mono', Consolas, monospace";
    ctx.textAlign = "center";
    for (const a of this.monthAnchors) {
      const p = arcPoint(a.t);
      const n = arcNormal(a.t);
      ctx.fillText(
        a.label,
        ((p.x + n.x * 7) / 100) * W,
        ((p.y + n.y * 7) / 100) * H
      );
    }
    ctx.globalAlpha = 1;

    for (let i = 1; i < this.layers.length; i++) this.layers[i].draw(f);

    if (hover.star) {
      this.onHover?.({
        x: hover.star.x,
        y: hover.star.y,
        count: hover.star.day.count,
        date: hover.star.day.date,
        language: hover.star.day.language,
        monthLabel: hover.star.monthLabel,
        projectName: this.dateToProject.get(hover.star.day.date),
      });
    } else {
      this.onHover?.(null);
    }
  }
}
