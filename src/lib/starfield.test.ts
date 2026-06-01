import test from "node:test";
import assert from "node:assert/strict";
import { normalizedRadius, MIN_R, HERO_R } from "./starfield.ts";

test("normalizedRadius: a zero-commit day has no radius", () => {
  assert.equal(normalizedRadius(0, 10), 0);
});

test("normalizedRadius: the busiest day reaches HERO_R", () => {
  assert.ok(Math.abs(normalizedRadius(10, 10) - HERO_R) < 1e-9);
});

test("normalizedRadius: in a sparse history a 1-commit day is prominent but below hero", () => {
  const r = normalizedRadius(1, 3);
  assert.ok(r >= MIN_R, `expected >= ${MIN_R}, got ${r}`);
  assert.ok(r < HERO_R, `expected < ${HERO_R}, got ${r}`);
});

test("normalizedRadius: never divides by zero when maxCount is 0", () => {
  assert.equal(normalizedRadius(0, 0), 0);
  assert.ok(normalizedRadius(1, 0) >= MIN_R);
});
