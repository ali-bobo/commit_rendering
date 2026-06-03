import { useEffect, useRef, useState } from "react";
import type { ConstellationData } from "../lib/types";
import {
  ConstellationRenderer,
  type HoverInfo,
  type RendererOptions,
} from "../lib/renderer";

interface Props {
  data: ConstellationData;
  /**
   * Preview mode for the animated README capture (scripts/screenshot.mjs):
   * stronger drift so the wobble reads in a short clip, and no mouse-gravity
   * because there is no pointer when rendering headless.
   */
  preview?: boolean;
}

export function Constellation({ data, preview = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ConstellationRenderer | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [opts, setOpts] = useState<RendererOptions>(() => ({
    drift: preview ? 1.7 : 1,
    gravity: !preview,
    meteors: true,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ConstellationRenderer(canvas, data, opts);
    renderer.onHover = setHover;
    renderer.start();
    rendererRef.current = renderer;

    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      renderer.setPointer(e.clientX - r.left, e.clientY - r.top);
    };
    const onLeave = () => renderer.clearPointer();
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      renderer.stop();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    rendererRef.current?.setOptions(opts);
  }, [opts]);

  return (
    <div className="cc-wrap">
      <div className="cc-canvas-holder">
        <canvas ref={canvasRef} className="cc-canvas" aria-label="貢獻星座圖" />
        {hover && (
          <div
            className="cc-tip"
            style={{ left: hover.x, top: hover.y }}
            role="status"
          >
            <b>{hover.count}</b> commits · {hover.monthLabel}
            {Number(hover.date.slice(8, 10))}日
            {hover.language ? " · " + hover.language : ""}
            {hover.projectName ? " · ✦ " + hover.projectName : ""}
          </div>
        )}
      </div>

      <div className="cc-legend">
        {data.languages.map((l) => (
          <span key={l.name} className="cc-legend-item">
            <span
              className="cc-dot"
              style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }}
            />
            {l.name}
          </span>
        ))}
      </div>

      <div className="cc-controls">
        <label className="cc-ctrl">
          漂移
          <input
            type="range"
            min={0}
            max={100}
            value={opts.drift * 50}
            onChange={(e) =>
              setOpts((o) => ({ ...o, drift: Number(e.target.value) / 50 }))
            }
          />
        </label>
        <label className="cc-ctrl">
          <input
            type="checkbox"
            checked={opts.gravity}
            onChange={(e) =>
              setOpts((o) => ({ ...o, gravity: e.target.checked }))
            }
          />
          滑鼠引力
        </label>
        <label className="cc-ctrl">
          <input
            type="checkbox"
            checked={opts.meteors}
            onChange={(e) =>
              setOpts((o) => ({ ...o, meteors: e.target.checked }))
            }
          />
          流星
        </label>
      </div>
    </div>
  );
}
