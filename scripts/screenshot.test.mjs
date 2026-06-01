import test from "node:test";
import assert from "node:assert/strict";
import { buildWebpArgs } from "./screenshot.mjs";

test("buildWebpArgs: produces a looping, full-colour animated WebP command", () => {
  const args = buildWebpArgs({
    pattern: "/tmp/frames/f-%03d.png",
    out: "/tmp/preview.webp",
    fps: 20,
    width: 760,
    quality: 72,
  });

  // Input sequence and output are wired correctly.
  assert.equal(args.at(-1), "/tmp/preview.webp");
  assert.ok(args.includes("/tmp/frames/f-%03d.png"));

  // libwebp encoder + infinite loop = animated WebP (not a still image).
  const i = args.indexOf("-c:v");
  assert.equal(args[i + 1], "libwebp");
  assert.equal(args[args.indexOf("-loop") + 1], "0");

  // Numeric settings are passed as strings (spawn requires string argv).
  assert.equal(args[args.indexOf("-framerate") + 1], "20");
  assert.equal(args[args.indexOf("-quality") + 1], "72");
  assert.ok(args.includes("scale=760:-1:flags=lanczos"));
});

test("buildWebpArgs: -y lets it overwrite the committed preview", () => {
  const args = buildWebpArgs({
    pattern: "f-%03d.png",
    out: "preview.webp",
    fps: 25,
    width: 900,
    quality: 80,
  });
  assert.equal(args[0], "-y");
  assert.equal(args[args.indexOf("-framerate") + 1], "25");
  assert.ok(args.includes("scale=900:-1:flags=lanczos"));
});
