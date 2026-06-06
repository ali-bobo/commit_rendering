import type { Layer, FrameContext } from "./types";

/** §2.3 black-hole overlay — implemented in Task 11. */
export class BlackHoleOverlayLayer implements Layer {
  draw(_f: FrameContext): void {}
}
