import test from "node:test";
import assert from "node:assert/strict";
import {
  meteorAlpha,
  meteorTail,
  scriptedMeteor,
  scriptedControl,
  SPAWN,
  DURATION,
  TAIL_SAMPLES,
  TAIL_W_HEAD,
  TAIL_W_TIP,
  TAIL_U,
  P0,
  P1,
} from "./meteor.ts";

const L = 13.97; // capture loop period used by screenshot.mjs

test("meteorAlpha: 端點為 0（seam 安全）、中段接近全亮", () => {
  assert.equal(meteorAlpha(0), 0);
  assert.equal(meteorAlpha(1), 0);
  assert.ok(meteorAlpha(0.5) > 0.9, `mid=${meteorAlpha(0.5)}`);
});

test("meteorTail: 10 點、w 嚴格遞減、首末寬度符合規格", () => {
  const c = scriptedControl();
  const s = meteorTail(P0, c, P1, 0.5, TAIL_U);
  assert.equal(s.length, TAIL_SAMPLES);
  assert.equal(s.length, 10);
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i].w < s[i - 1].w, `w[${i}]=${s[i].w} < w[${i - 1}]=${s[i - 1].w}`);
  }
  assert.ok(Math.abs(s[0].w - TAIL_W_HEAD) < 1e-9 && Math.abs(TAIL_W_HEAD - 2.6) < 1e-9);
  assert.ok(Math.abs(s[s.length - 1].w - TAIL_W_TIP) < 1e-9 && Math.abs(TAIL_W_TIP - 0.3) < 1e-9);
});

test("scriptedMeteor: 視窗外回傳 null", () => {
  assert.equal(scriptedMeteor(0, L), null);
  assert.equal(scriptedMeteor(SPAWN + DURATION + 0.001, L), null);
  assert.equal(scriptedMeteor(L - 0.01, L), null);
});

test("scriptedMeteor: 流星在 collapse 開始前完全結束", () => {
  assert.ok(
    SPAWN + DURATION < L - 6.3,
    `SPAWN+DURATION=${SPAWN + DURATION} 必須 < calm=${L - 6.3}`
  );
});

test("scriptedMeteor: 同一 phase 結果 deep-equal（純函式）", () => {
  const a = scriptedMeteor(1.1, L);
  const b = scriptedMeteor(1.1, L);
  assert.ok(a !== null && b !== null);
  assert.deepEqual(a, b);
});

test("scriptedMeteor: 可見期間所有 sample 的 x,y 落在 [-5, 105]", () => {
  for (let phase = SPAWN + 0.01; phase < SPAWN + DURATION; phase += 0.05) {
    const fr = scriptedMeteor(phase, L);
    assert.ok(fr !== null, `phase=${phase} 應可見`);
    for (const p of fr.samples) {
      assert.ok(p.x >= -5 && p.x <= 105, `x=${p.x} @ phase=${phase}`);
      assert.ok(p.y >= -5 && p.y <= 105, `y=${p.y} @ phase=${phase}`);
    }
  }
});
