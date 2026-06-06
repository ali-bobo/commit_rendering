import test from "node:test";
import assert from "node:assert/strict";
import {
  hexToRgb,
  rgbToHex,
  mixHex,
  accentColor,
  rgba,
  PALETTE,
} from "./color.ts";

test("mixHex: t=0 回傳 a，t=1 回傳 b", () => {
  assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
});

test("mixHex: 同色混合恆為自身", () => {
  assert.equal(mixHex("#ff9e7a", "#ff9e7a", 0.37), "#ff9e7a");
});

test("rgbToHex(hexToRgb(x)) round-trip", () => {
  for (const h of ["#ff9e7a", "#6c7bff", "#020108"]) {
    const [r, g, b] = hexToRgb(h);
    assert.equal(rgbToHex(r, g, b), h);
  }
});

test("accentColor: 夾在 [0,1]，端點等於 ramp 兩端", () => {
  assert.equal(accentColor(-5), accentColor(0));
  assert.equal(accentColor(5), accentColor(1));
});

test("rgba: 產生合法 rgba() 字串", () => {
  assert.equal(rgba("#ff9e7a", 0.5), "rgba(255,158,122,0.5)");
});

test("PALETTE: 5 色 coral→indigo", () => {
  assert.equal(PALETTE.length, 5);
  assert.equal(PALETTE[0], "#ff9e7a");
  assert.equal(PALETTE[4], "#6c7bff");
});
