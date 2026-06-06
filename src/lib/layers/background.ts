import type { Layer, FrameContext } from "./types";

const NEBULA_BLOBS: { x: number; y: number; c: string }[] = [
  { x: 14, y: 82, c: "rgba(255,140,120,0.11)" },
  { x: 30, y: 70, c: "rgba(255,120,165,0.10)" },
  { x: 46, y: 78, c: "rgba(230,110,185,0.08)" },
  { x: 55, y: 46, c: "rgba(200,110,222,0.08)" },
  { x: 70, y: 36, c: "rgba(160,110,255,0.08)" },
  { x: 85, y: 26, c: "rgba(120,130,255,0.07)" },
  { x: 62, y: 60, c: "rgba(255,150,150,0.06)" },
];

/** Deep-plum gradient, warm→cool nebula blobs, and twinkling distant stars. */
export class BackgroundLayer implements Layer {
  private bg: { x: number; y: number; r: number; tw: number }[];

  constructor(seededRand: () => number) {
    this.bg = [];
    for (let i = 0; i < 220; i++) {
      this.bg.push({
        x: seededRand() * 100,
        y: seededRand() * 100,
        r: seededRand() * 0.9 + 0.2,
        tw: seededRand(),
      });
    }
  }

  draw(f: FrameContext): void {
    const { ctx, W, H, tt } = f;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1d1026");
    grad.addColorStop(0.5, "#1a1030");
    grad.addColorStop(1, "#141228");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const b of NEBULA_BLOBS) {
      const nx = (b.x / 100) * W;
      const ny = (b.y / 100) * H;
      const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * 0.3);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    for (const s of this.bg) {
      const x = (s.x / 100) * W;
      const y = (s.y / 100) * H;
      ctx.globalAlpha =
        0.2 + 0.5 * (0.5 + 0.5 * Math.sin(tt * 1.5 + s.tw * 6.28));
      ctx.fillStyle = "#f3e9ff";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
