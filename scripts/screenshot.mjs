// Captures the rendered nebula for embedding in a GitHub profile README.
//
// A README is Markdown — it cannot run the live Canvas app — so we render the
// app headless and produce two artefacts:
//   - public/preview.png   a single still frame (universal fallback)
//   - public/preview.webp  an *animated* WebP (twinkle + drift), when ffmpeg
//                          is available
//
// WebP is full-colour, so the pink-orange nebula gradient stays smooth (a GIF's
// 256-colour palette would band it badly) and stays small. Encoding needs an
// ffmpeg binary: GitHub Actions' ubuntu runners ship one; locally the script
// still writes preview.png and skips the WebP with a warning. Set $FFMPEG_PATH
// to point at a specific binary.
//
// Requires: npm run build first (dist/ must exist).
// Run: node scripts/screenshot.mjs

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PNG_OUT = resolve(ROOT, "public", "preview.png");
const WEBP_OUT = resolve(ROOT, "public", "preview.webp");
const FRAMES_DIR = resolve(ROOT, ".preview-frames");
const PORT = 4173;

// Capture / encode settings. Tuned to keep the committed WebP small (~a few MB)
// while still showing the twinkle and drift.
const FRAME_COUNT = 254; // ~14s window (254 * 55ms ≈ 13.97s): ~7.7s calm + 6.3s BH action
const FRAME_INTERVAL = 55; // ms between grabs (wall-clock)
const LOOP_SECONDS = (FRAME_COUNT * FRAME_INTERVAL) / 1000; // single source of truth
const PLAYBACK_FPS = 18; // ≈ 1000/55ms capture rate; avoids the 10% speedup from 20fps
const WEBP_WIDTH = 760; // downscale width in px; -1 keeps aspect ratio
const WEBP_QUALITY = 82; // libwebp quality 0..100 (higher = smoother gradients)

/**
 * Build the ffmpeg argument list that encodes a zero-padded PNG frame sequence
 * into a single looping animated WebP. Kept pure so it can be unit-tested
 * without invoking ffmpeg (which is not always present locally).
 */
export function buildWebpArgs({ pattern, out, fps, width, quality }) {
  return [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    pattern,
    "-vf",
    `scale=${width}:-1:flags=lanczos`,
    "-c:v",
    "libwebp",
    "-lossless",
    "0",
    "-quality",
    String(quality),
    "-compression_level",
    "6",
    "-loop",
    "0",
    "-an",
    out,
  ];
}

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", rej);
    p.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited with code ${code}`))
    );
  });
}

async function encodeWebp() {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const args = buildWebpArgs({
    pattern: resolve(FRAMES_DIR, "f-%03d.png"),
    out: WEBP_OUT,
    fps: PLAYBACK_FPS,
    width: WEBP_WIDTH,
    quality: WEBP_QUALITY,
  });
  try {
    await run(ffmpeg, args);
    console.log(`Animated WebP saved: ${WEBP_OUT}`);
  } catch (err) {
    // Not fatal: the still PNG is enough for the README to render, just not
    // animated. Surface it loudly so a missing CI ffmpeg is noticed.
    console.warn(
      `WARNING: skipped animated WebP (ffmpeg unavailable or failed): ${
        err.message ?? err
      }`
    );
  }
}

async function captureFrames() {
  await rm(FRAMES_DIR, { recursive: true, force: true });
  await mkdir(FRAMES_DIR, { recursive: true });

  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: "pipe", shell: process.platform === "win32" }
  );
  server.stderr.on("data", (d) => process.stderr.write(d));
  await new Promise((r) => setTimeout(r, 3000));

  const browser = await chromium.launch();
  try {
    // deviceScaleFactor: 2 makes the renderer draw the canvas at 2x internal
    // resolution (its DPR cap), so the captured frames are supersampled and stay
    // crisp after the lanczos downscale to WEBP_WIDTH — fixes the soft/aliased
    // look of the 1x default.
    const context = await browser.newContext({
      viewport: { width: 1040, height: 680 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    // ?capture disables mouse-gravity; ?loop drives a seamless black-hole loop
    // whose period equals this recording window (see App.tsx / renderer).
    await page.goto(`http://localhost:${PORT}/?capture=1&loop=${LOOP_SECONDS}`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector(".cc-canvas", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 800)); // let stars ease into place

    // Static fallback frame.
    await page.locator(".cc-canvas").screenshot({ path: PNG_OUT });
    console.log(`Static preview saved: ${PNG_OUT}`);

    // Frame sequence for the animation, grabbed straight off the canvas.
    for (let i = 0; i < FRAME_COUNT; i++) {
      const dataUrl = await page.evaluate(() => {
        const c = document.querySelector(".cc-canvas");
        return c ? c.toDataURL("image/png") : null;
      });
      if (!dataUrl) throw new Error("canvas disappeared during capture");
      const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const name = `f-${String(i).padStart(3, "0")}.png`;
      await writeFile(resolve(FRAMES_DIR, name), Buffer.from(b64, "base64"));
      await new Promise((r) => setTimeout(r, FRAME_INTERVAL));
    }
    console.log(`Captured ${FRAME_COUNT} frames`);
  } finally {
    await browser.close();
    server.kill();
  }
}

async function main() {
  let exitCode = 0;
  try {
    await captureFrames();
    await encodeWebp();
  } catch (err) {
    console.error("Preview generation failed:", err.message ?? err);
    exitCode = 1;
  } finally {
    await rm(FRAMES_DIR, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

// Only run when executed directly, so tests can import buildWebpArgs.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
