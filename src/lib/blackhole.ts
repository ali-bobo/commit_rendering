export type Phase = "calm" | "collapse" | "sing" | "rebirth";

export interface PhaseState {
  phase: Phase;
  /** Progress within the current phase, 0..1. */
  pp: number;
  /** Inward pull, 0 (home) .. 1 (centre). */
  suck: number;
  /** Motion-blur tail length factor (0 = none). */
  tail: number;
  /** Event-horizon radius in px. */
  eh: number;
  /** Hot-glow intensity, 0..1. */
  hot: number;
  /** False in calm or when disabled → transform is identity. */
  active: boolean;
}

export interface BHConfig {
  calm: number;
  collapse: number;
  sing: number;
  rebirth: number;
  /** Max event-horizon radius (px). */
  ehMax: number;
  /** Swirl turns scaled into the spiral trajectory. */
  swirl: number;
}

// ~18s cycle with calm dominant (mockup used 3.5s calm only for the demo).
export const DEFAULT_BH: BHConfig = {
  calm: 11.7,
  collapse: 3.2,
  sing: 0.7,
  rebirth: 2.4,
  ehMax: 30,
  swirl: 10,
};

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export class BlackHoleController {
  private cfg: BHConfig;
  private enabled: boolean;

  constructor(cfg: BHConfig = DEFAULT_BH, enabled = true) {
    this.cfg = cfg;
    this.enabled = enabled;
  }

  get cycle(): number {
    const c = this.cfg;
    return c.calm + c.collapse + c.sing + c.rebirth;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Phase + derived scalars at absolute time tt (seconds). */
  state(tt: number): PhaseState {
    if (!this.enabled) {
      return { phase: "calm", pp: 0, suck: 0, tail: 0, eh: 0, hot: 0, active: false };
    }
    const c = this.cfg;
    const ph = ((tt % this.cycle) + this.cycle) % this.cycle;

    let phase: Phase;
    let pp: number;
    if (ph < c.calm) {
      phase = "calm";
      pp = ph / c.calm;
    } else if (ph < c.calm + c.collapse) {
      phase = "collapse";
      pp = (ph - c.calm) / c.collapse;
    } else if (ph < c.calm + c.collapse + c.sing) {
      phase = "sing";
      pp = (ph - c.calm - c.collapse) / c.sing;
    } else {
      phase = "rebirth";
      pp = (ph - c.calm - c.collapse - c.sing) / c.rebirth;
    }

    let suck = 0;
    let tail = 0;
    let eh = 0;
    let hot = 0;
    if (phase === "collapse") {
      suck = pp * pp;
      tail = 0.05 + 0.18 * pp;
      eh = c.ehMax * Math.min(1, pp * 1.2);
      hot = Math.min(1, pp * 1.5);
    } else if (phase === "sing") {
      suck = 1;
      eh = c.ehMax;
      hot = 1;
    } else if (phase === "rebirth") {
      suck = 1 - easeOut(pp);
      tail = 0.12 * (1 - pp);
      eh = c.ehMax * (1 - easeOut(pp));
      hot = 1 - pp;
    }

    return { phase, pp, suck, tail, eh, hot, active: phase !== "calm" };
  }

  /**
   * Maps a star's home px position onto its spiral trajectory toward (cx,cy).
   * Identity when inactive. `swallowed` is true once inside 0.95·eh.
   */
  transform(
    home: { x: number; y: number },
    st: PhaseState,
    cx: number,
    cy: number,
    spin: number
  ): { x: number; y: number; r: number; swallowed: boolean } {
    if (!st.active) {
      return {
        x: home.x,
        y: home.y,
        r: Math.hypot(home.x - cx, home.y - cy),
        swallowed: false,
      };
    }
    const dx = home.x - cx;
    const dy = home.y - cy;
    const r0 = Math.hypot(dx, dy);
    const a0 = Math.atan2(dy, dx);
    const r = r0 * (1 - st.suck);
    const a = a0 + this.cfg.swirl * st.suck * spin;
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      r,
      swallowed: r < st.eh * 0.95,
    };
  }
}
