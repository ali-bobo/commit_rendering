import test from "node:test";
import assert from "node:assert/strict";
import { snapFreq } from "./loopfreq.ts";

const TAU = 2 * Math.PI;

test("snapFreq: result*period 是 2π 的整數倍（一個週期內整數圈）", () => {
  for (const [f, L] of [
    [0.5, 8],
    [1.5, 8],
    [2.6, 7.975],
    [0.25, 8],
  ]) {
    const s = snapFreq(f, L);
    const cycles = (s * L) / TAU;
    assert.ok(
      Math.abs(cycles - Math.round(cycles)) < 1e-9,
      `f=${f} L=${L} cycles=${cycles}`
    );
  }
});

test("snapFreq: 低頻不被吃成 0（至少 1 圈/週期）", () => {
  const s = snapFreq(0.05, 8); // 0.05*8/2π≈0.064 → round 0 → 須夾到 1
  assert.ok(s >= TAU / 8 - 1e-9, `got ${s}`);
});

test("snapFreq: 取最近諧波 (1.5, L=8 → 2 圈)", () => {
  // 1.5*8/2π = 1.909 → round 2 → 2*2π/8
  assert.ok(Math.abs(snapFreq(1.5, 8) - (2 * TAU) / 8) < 1e-9);
});

test("snapFreq: 高頻取對應整數圈 (2.6, L=8 → 3 圈)", () => {
  // 2.6*8/2π = 3.31 → round 3
  assert.ok(Math.abs(snapFreq(2.6, 8) - (3 * TAU) / 8) < 1e-9);
});
