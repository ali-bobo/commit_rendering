import type { Layer, FrameContext } from "./types";

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/** Occasional shooting stars. Paused during black-hole activity and reduced motion. */
export class MeteorLayer implements Layer {
  private meteors: Meteor[] = [];
  private next = 2;

  draw(f: FrameContext): void {
    const { ctx, W, H, dt, opts, reduceMotion, blackHole } = f;
    const allow = opts.meteors && !reduceMotion && !blackHole.active;
    if (allow) {
      this.next -= dt;
      if (this.next <= 0) {
        this.meteors.push({
          x: Math.random() * W,
          y: -10,
          vx: -(2 + Math.random() * 2),
          vy: 3 + Math.random() * 2,
          life: 1,
        });
        this.next = 2 + Math.random() * 4;
      }
    }
    // In-flight meteors always finish their fall; only spawning pauses (above).
    for (const me of this.meteors) {
      me.x += me.vx * 60 * dt;
      me.y += me.vy * 60 * dt;
      me.life -= dt * 0.5;
      const tg = ctx.createLinearGradient(me.x, me.y, me.x - me.vx * 16, me.y - me.vy * 16);
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
  }
}
