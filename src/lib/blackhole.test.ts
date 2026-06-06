import test from "node:test";
import assert from "node:assert/strict";
import { BlackHoleController, DEFAULT_BH } from "./blackhole.ts";

test("state: calm 起點，active=false", () => {
  const bh = new BlackHoleController();
  const s = bh.state(0);
  assert.equal(s.phase, "calm");
  assert.equal(s.active, false);
  assert.equal(s.suck, 0);
  assert.equal(s.eh, 0);
});

test("state: phase 邊界依序 calm→collapse→sing→rebirth", () => {
  const bh = new BlackHoleController();
  const { calm, collapse, sing } = DEFAULT_BH;
  assert.equal(bh.state(calm - 0.01).phase, "calm");
  assert.equal(bh.state(calm + 0.01).phase, "collapse");
  assert.equal(bh.state(calm + collapse + 0.01).phase, "sing");
  assert.equal(bh.state(calm + collapse + sing + 0.01).phase, "rebirth");
});

test("state: collapse 期間 suck 與 eh 單調遞增", () => {
  const bh = new BlackHoleController();
  const { calm } = DEFAULT_BH;
  const early = bh.state(calm + 0.3);
  const late = bh.state(calm + 2.5);
  assert.ok(late.suck > early.suck, `suck ${late.suck} > ${early.suck}`);
  assert.ok(late.eh > early.eh, `eh ${late.eh} > ${early.eh}`);
  assert.ok(early.active);
});

test("transform: 停用時為 identity（active=false）", () => {
  const bh = new BlackHoleController(DEFAULT_BH, false);
  const s = bh.state(DEFAULT_BH.calm + 1);
  assert.equal(s.active, false);
  const r = bh.transform({ x: 100, y: 50 }, s, 0, 0, 1);
  assert.equal(r.x, 100);
  assert.equal(r.y, 50);
  assert.equal(r.swallowed, false);
});

test("transform: sing 時 suck=1，靠中心的星被吞 (swallowed)", () => {
  const bh = new BlackHoleController();
  const { calm, collapse } = DEFAULT_BH;
  const s = bh.state(calm + collapse + 0.1);
  assert.equal(s.suck, 1);
  const r = bh.transform({ x: 100, y: 0 }, s, 0, 0, 1);
  assert.ok(r.swallowed, `r=${r.r}, eh=${s.eh}`);
});

test("cycle ≈ 18 秒，calm 佔大部分", () => {
  const bh = new BlackHoleController();
  assert.ok(Math.abs(bh.cycle - 18) < 0.5, `cycle=${bh.cycle}`);
  assert.ok(DEFAULT_BH.calm > DEFAULT_BH.collapse + DEFAULT_BH.sing + DEFAULT_BH.rebirth);
});
