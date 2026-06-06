import type { Star, MonthAnchor } from "../layout";
import type { ProjectGroup } from "../projects";
import type { PhaseState } from "../blackhole";
import type { RendererOptions } from "../renderer-options";

export interface HoverState {
  project: ProjectGroup | null;
  star: Star | null;
}

/** Everything a layer needs to draw one frame. Built fresh by the orchestrator. */
export interface FrameContext {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  tt: number; // accumulated animation time (seconds)
  dt: number; // delta since last frame (seconds)
  pointer: { x: number; y: number } | null;
  reduceMotion: boolean;
  opts: RendererOptions;
  stars: Star[];
  projects: ProjectGroup[];
  monthAnchors: MonthAnchor[];
  blackHole: PhaseState;
  hover: HoverState;
  /** Black-hole centre in px (canvas centre-ish), shared by transform + overlay. */
  center: { x: number; y: number };
  /** Loop period (s) when capturing a seamless loop, else null. Layers snap
   *  their animation frequencies to this so the whole scene loops. */
  loopPeriod: number | null;
}

export interface Layer {
  draw(f: FrameContext): void;
}
