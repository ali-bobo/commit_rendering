import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectGroups, centroid, radius } from "./projects.ts";
import type { Star } from "./layout.ts";
import type { ConstellationData } from "./types.ts";

function star(date: string, t: number, x = 0, y = 0): Star {
  return {
    day: { date, count: 1, language: null },
    bx: 0, by: 0, x, y, r: 1, t, twk: 0, tws: 1, spin: 1,
    col: "#fff", monthLabel: "", swallowed: false,
  };
}

function data(projects: ConstellationData["projects"]): ConstellationData {
  return {
    schemaVersion: 1, user: "u", generatedAt: "", totalContributions: 0,
    isMock: true, days: [], languages: [], projects,
  };
}

test("buildProjectGroups: 成員對應 starDates 並依 t 排序", () => {
  const stars = [
    star("2026-03-01", 0.6),
    star("2026-01-01", 0.1),
    star("2026-02-01", 0.3),
  ];
  const groups = buildProjectGroups(
    data([{ name: "p", starDates: ["2026-03-01", "2026-01-01", "2026-02-01"] }]),
    stars
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].members.map((m) => m.day.date),
    ["2026-01-01", "2026-02-01", "2026-03-01"]
  );
});

test("buildProjectGroups: meanT = 成員 t 平均", () => {
  const stars = [star("a", 0.2), star("b", 0.6)];
  const groups = buildProjectGroups(
    data([{ name: "p", starDates: ["a", "b"] }]),
    stars
  );
  assert.ok(Math.abs(groups[0].meanT - 0.4) < 1e-9);
});

test("buildProjectGroups: 相鄰專案（依 meanT）hueA 不同（交錯）", () => {
  const stars = [star("a", 0.1), star("b", 0.5), star("c", 0.9)];
  const groups = buildProjectGroups(
    data([
      { name: "early", starDates: ["a"] },
      { name: "mid", starDates: ["b"] },
      { name: "late", starDates: ["c"] },
    ]),
    stars
  );
  const byT = [...groups].sort((g1, g2) => g1.meanT - g2.meanT);
  assert.notEqual(byT[0].hueA, byT[1].hueA);
  assert.notEqual(byT[1].hueA, byT[2].hueA);
});

test("buildProjectGroups: 每團都有兩個不同色相（一暖一冷）", () => {
  const stars = [star("a", 0.3)];
  const groups = buildProjectGroups(
    data([{ name: "p", starDates: ["a"] }]),
    stars
  );
  assert.notEqual(groups[0].hueA, groups[0].hueB);
});

test("centroid / radius: 用成員 live px 位置", () => {
  const stars = [star("a", 0.2, 0, 0), star("b", 0.4, 4, 0), star("c", 0.6, 2, 6)];
  const [g] = buildProjectGroups(
    data([{ name: "p", starDates: ["a", "b", "c"] }]),
    stars
  );
  const c = centroid(g);
  assert.ok(Math.abs(c.x - 2) < 1e-9);
  assert.ok(Math.abs(c.y - 2) < 1e-9);
  assert.ok(Math.abs(radius(g, c.x, c.y) - 4) < 1e-9);
});

test("buildProjectGroups: 略過 starDates 中不存在於 stars 的日期", () => {
  const stars = [star("a", 0.2)];
  const [g] = buildProjectGroups(
    data([{ name: "p", starDates: ["a", "ghost"] }]),
    stars
  );
  assert.equal(g.members.length, 1);
});
