import test from "node:test";
import assert from "node:assert/strict";
import { coverRect } from "./cover.ts";

test("coverRect: 比例保持 (dw/dh == imgW/imgH)", () => {
  const r = coverRect(2280, 433, 760, 300);
  assert.ok(Math.abs(r.dw / r.dh - 2280 / 433) < 1e-9);
});

test("coverRect: 涵蓋整個框 (dx,dy<=0 且右下角超出框)", () => {
  const r = coverRect(2280, 433, 760, 300);
  assert.ok(r.dx <= 1e-9 && r.dy <= 1e-9);
  assert.ok(r.dx + r.dw >= 760 - 1e-9);
  assert.ok(r.dy + r.dh >= 300 - 1e-9);
});

test("coverRect: 超寬圖塞較方框 → 高度綁定、左右被裁", () => {
  // 2280x433 (5.26:1) into 760x300 (2.53:1): height binds, width overflows
  const r = coverRect(2280, 433, 760, 300);
  assert.ok(r.dh >= 300 - 1e-9, `dh=${r.dh}`);
  assert.ok(r.dw > 760, `dw=${r.dw}`);
  assert.ok(r.dx < 0, `dx=${r.dx}`);
});

test("coverRect: 較高框 → 寬度綁定", () => {
  // 100x100 into 50x200: scale=max(0.5,2)=2 → dw=dh=200, covers
  const r = coverRect(100, 100, 50, 200);
  assert.ok(r.dw >= 50 - 1e-9 && r.dh >= 200 - 1e-9);
  assert.ok(r.dy <= 1e-9);
});
