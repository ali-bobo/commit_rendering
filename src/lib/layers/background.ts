import type { Layer, FrameContext } from "./types";
import { coverRect } from "../cover";
import { snapFreq } from "../loopfreq";

// Deep-plum→indigo backdrop, nudged slightly cooler (toward blue) so it sits
// under the cool galaxy photo without a warm/cool clash. DATA colours (star
// bodies/glow, language legend, project nebulae) are untouched — only this
// decorative backdrop moves, and only slightly.
const GRADIENT_STOPS: [number, string][] = [
  [0, "#181430"],
  [0.5, "#151432"],
  [1, "#11132a"],
];

// Warm→cool nebula blobs. The warm end was nudged toward cool violet to meet the
// photo, then deepened + faded so they screen-blend over the photo as subtle
// coloured light (not flat washes). Drawn with "screen" (see draw()).
const NEBULA_BLOBS: { x: number; y: number; c: string }[] = [
  { x: 14, y: 82, c: "rgba(144,108,130,0.085)" },
  { x: 30, y: 70, c: "rgba(140,97,137,0.08)" },
  { x: 46, y: 78, c: "rgba(166,79,133,0.065)" },
  { x: 55, y: 46, c: "rgba(144,79,160,0.065)" },
  { x: 70, y: 36, c: "rgba(115,79,184,0.065)" },
  { x: 85, y: 26, c: "rgba(86,94,184,0.055)" },
  { x: 62, y: 60, c: "rgba(137,108,133,0.05)" },
];

// Alpha of the cool gradient drawn OVER the photo: knocks it back to a recessed
// texture, unifies colour temperature, keeps data stars legible. Tunable.
const PHOTO_OVERLAY_ALPHA = 0.5;
const PHOTO_BLUR_PX = 3;

/**
 * Deep-plum gradient (optionally over a cover-fit, blurred galaxy photo), warm→
 * cool nebula blobs, and twinkling distant stars. If a photo URL is given it is
 * loaded async and cached to an offscreen canvas; until then (or on load error)
 * the layer renders the procedural gradient alone.
 */
export class BackgroundLayer implements Layer {
  private bg: { x: number; y: number; r: number; tw: number }[];
  private img: HTMLImageElement | null = null;
  private imgLoaded = false;
  private cache: HTMLCanvasElement | null = null;
  private cacheW = 0;
  private cacheH = 0;

  constructor(seededRand: () => number, bgImageUrl?: string) {
    this.bg = [];
    for (let i = 0; i < 220; i++) {
      this.bg.push({
        x: seededRand() * 100,
        y: seededRand() * 100,
        r: seededRand() * 0.9 + 0.2,
        tw: seededRand(),
      });
    }
    if (bgImageUrl) {
      const img = new Image();
      img.onload = () => {
        this.imgLoaded = true;
      };
      img.onerror = () => {
        // Stay on the procedural fallback; never throw, never log the URL.
        this.imgLoaded = false;
      };
      img.src = bgImageUrl;
      this.img = img;
    }
  }

  /** Pre-render the cover-fit, blurred photo to an offscreen canvas (once per size). */
  private buildCache(W: number, H: number): void {
    if (!this.img) return;
    if (this.cache && this.cacheW === W && this.cacheH === H) return;
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d");
    if (!octx) return;
    const { dx, dy, dw, dh } = coverRect(
      this.img.naturalWidth,
      this.img.naturalHeight,
      W,
      H
    );
    octx.filter = `blur(${PHOTO_BLUR_PX}px)`;
    octx.drawImage(this.img, dx, dy, dw, dh);
    octx.filter = "none";
    this.cache = off;
    this.cacheW = W;
    this.cacheH = H;
  }

  draw(f: FrameContext): void {
    const { ctx, W, H, tt } = f;

    // Base layer: the photo if loaded (covers the canvas, clearing the previous
    // frame), else the opaque gradient below does the clearing.
    let overlayAlpha = 1; // opaque gradient = procedural fallback / clear
    if (this.imgLoaded && this.img) {
      this.buildCache(W, H);
      if (this.cache) {
        ctx.drawImage(this.cache, 0, 0);
        overlayAlpha = PHOTO_OVERLAY_ALPHA; // let the photo show through
      }
    }

    // Cool gradient: opaque when there's no photo, translucent over the photo.
    const grad = ctx.createLinearGradient(0, 0, W, H);
    for (const [stop, color] of GRADIENT_STOPS) grad.addColorStop(stop, color);
    ctx.globalAlpha = overlayAlpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Nebula glow blobs — screened so they add coloured light to the photo and
    // blend in rather than sitting on top as flat washes.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const b of NEBULA_BLOBS) {
      const nx = (b.x / 100) * W;
      const ny = (b.y / 100) * H;
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * 0.3);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // Distant stars. (Twinkle frequency snaps to the loop in capture mode.)
    const bgTwFreq = f.loopPeriod ? snapFreq(1.5, f.loopPeriod) : 1.5;
    for (const s of this.bg) {
      const x = (s.x / 100) * W;
      const y = (s.y / 100) * H;
      ctx.globalAlpha =
        0.2 + 0.5 * (0.5 + 0.5 * Math.sin(tt * bgTwFreq + s.tw * 6.28));
      ctx.fillStyle = "#f3e9ff";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
