import test from "node:test";
import assert from "node:assert/strict";
import { ARC, arcPoint, arcTangent, arcNormal } from "./arc.ts";

test("arcPoint: t=0 是弧的起點 (ARC[0])", () => {
  const p = arcPoint(0);
  assert.ok(Math.abs(p.x - ARC[0].x) < 1e-9);
  assert.ok(Math.abs(p.y - ARC[0].y) < 1e-9);
});

test("arcPoint: t=1 是弧的終點 (ARC[3])", () => {
  const p = arcPoint(1);
  assert.ok(Math.abs(p.x - ARC[3].x) < 1e-9);
  assert.ok(Math.abs(p.y - ARC[3].y) < 1e-9);
});

test("arcTangent: 與數值微分一致（連續、方向正確）", () => {
  const t = 0.4;
  const h = 1e-5;
  const a = arcPoint(t - h);
  const b = arcPoint(t + h);
  const fd = { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h) };
  const tan = arcTangent(t);
  assert.ok(Math.abs(tan.x - fd.x) < 1e-2, `x: ${tan.x} vs ${fd.x}`);
  assert.ok(Math.abs(tan.y - fd.y) < 1e-2, `y: ${tan.y} vs ${fd.y}`);
});

test("arcNormal: 單位長度且指向外側（上方，ny<=0）", () => {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const n = arcNormal(t);
    assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9, `unit @${t}`);
    assert.ok(n.y <= 1e-9, `outer @${t}: ny=${n.y}`);
  }
});
