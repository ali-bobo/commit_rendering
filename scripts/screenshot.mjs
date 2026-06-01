// Launches a headless browser, serves the built dist/, waits for the canvas
// to finish rendering, then saves a screenshot to public/preview.png.
//
// Requires: npm run build to have been run first (dist/ must exist).
// Run: node scripts/screenshot.mjs
//
// The resulting public/preview.png is committed to the repo so it can be
// embedded in a GitHub profile README as a static preview image.

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public", "preview.png");
const PORT = 4173;

// Start vite preview to serve the built dist/.
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: ROOT,
  stdio: "pipe",
  shell: process.platform === "win32",
});

server.stderr.on("data", (d) => process.stderr.write(d));

// Give the server a moment to start, then screenshot.
await new Promise((resolve) => setTimeout(resolve, 3000));

let exitCode = 0;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1040, height: 680 });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

  // Wait for canvas to appear (data has loaded) then let the animation settle.
  await page.waitForSelector(".cc-canvas", { timeout: 15000 });
  await new Promise((resolve) => setTimeout(resolve, 3500));

  // Screenshot just the canvas element.
  const canvas = page.locator(".cc-canvas");
  await canvas.screenshot({ path: OUT });

  console.log(`Screenshot saved: ${OUT}`);
  await browser.close();
} catch (err) {
  console.error("Screenshot failed:", err.message ?? err);
  exitCode = 1;
} finally {
  server.kill();
}

process.exit(exitCode);
