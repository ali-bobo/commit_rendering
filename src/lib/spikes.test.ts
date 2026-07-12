import test from "node:test";
import assert from "node:assert/strict";
import { topStarIndices } from "./spikes.ts";

test("topStarIndices: 一般案例取 count 前 4", () => {
  const days = [
    { date: "2026-01-01", count: 3 },
    { date: "2026-01-02", count: 9 },
    { date: "2026-01-03", count: 1 },
    { date: "2026-01-04", count: 7 },
    { date: "2026-01-05", count: 5 },
    { date: "2026-01-06", count: 8 },
  ];
  assert.deepEqual(topStarIndices(days, 4), [1, 5, 3, 4]);
});

test("topStarIndices: count 並列取日期較早者", () => {
  const days = [
    { date: "2026-03-10", count: 5 },
    { date: "2026-01-02", count: 5 },
    { date: "2026-02-05", count: 5 },
  ];
  // 全 count=5：只取 2 顆時應為日期最早的兩個 index（1 早於 2 早於 0）
  assert.deepEqual(topStarIndices(days, 2), [1, 2]);
});

test("topStarIndices: count=0 不入選", () => {
  const days = [
    { date: "2026-01-01", count: 0 },
    { date: "2026-01-02", count: 2 },
    { date: "2026-01-03", count: 0 },
  ];
  const r = topStarIndices(days, 4);
  assert.ok(!r.includes(0) && !r.includes(2));
  assert.deepEqual(r, [1]);
});

test("topStarIndices: 亮星不足 4 顆時回傳全部亮星", () => {
  const days = [
    { date: "2026-01-01", count: 4 },
    { date: "2026-01-02", count: 0 },
    { date: "2026-01-03", count: 6 },
  ];
  assert.deepEqual(topStarIndices(days, 4), [2, 0]);
});
