/**
 * User-facing render toggles, shared by the renderer (orchestrator) and the
 * layer FrameContext. Kept in its own leaf module so the layer types do not
 * depend on the renderer, avoiding a type-level import cycle.
 */
export interface RendererOptions {
  drift: number; // 0..1 multiplier
  gravity: boolean;
  meteors: boolean;
}
