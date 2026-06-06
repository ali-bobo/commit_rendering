/**
 * User-facing render toggles, shared by the renderer (orchestrator) and the
 * layer FrameContext. Kept in its own leaf module so the layer types do not
 * depend on the renderer, avoiding a type-level import cycle.
 */
export interface RendererOptions {
  drift: number; // 0..1 multiplier
  gravity: boolean;
  meteors: boolean;
  blackHole: boolean; // live-site only; off during ?capture and reduced-motion
  /**
   * When non-null (capture/loop mode): the black hole runs a cycle of this many
   * seconds, tt advances in real time (ignoring drift), and animations
   * harmonic-align to it so the README capture loops seamlessly.
   */
  loopPeriod: number | null;
}
