// Generates mock contribution data matching the data contract in
// src/lib/types.ts and writes it to public/data/contributions.json.
//
// Run: npm run fetch:mock
//
// This lets the whole visualization run today, before you wire up real
// GitHub data. The output shape is identical to the real fetcher, so the
// frontend never knows the difference.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data/contributions.json");

// Deterministic PRNG so mock output is stable across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANGUAGES = [
  { name: "TypeScript", color: "#ff9e7a" },
  { name: "Python", color: "#ffcaa0" },
  { name: "Rust", color: "#ff7a9e" },
  { name: "Go", color: "#ffb0d0" },
  { name: "GLSL", color: "#ffd9b0" },
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function buildDays(rand) {
  const days = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);

  let total = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    // Bias toward fewer commits, occasional bright bursts.
    const base = Math.pow(rand(), 2.4);
    const burst = rand() > 0.92 ? rand() * 0.6 : 0;
    const count = Math.floor((base + burst) * 15);
    total += count;

    // Pick a language; weekday months lean to a "main" language.
    const monthMain = (d.getMonth() * 7) % LANGUAGES.length;
    const langIdx =
      rand() < 0.7 ? monthMain : Math.floor(rand() * LANGUAGES.length);

    days.push({
      date: isoDate(d),
      count,
      language: count > 0 ? LANGUAGES[langIdx].name : null,
    });
  }
  return { days, total };
}

// Build a few named constellations from the brightest days.
function buildProjects(days, names) {
  const brightest = [...days]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  return names.map((name, i) => ({
    name,
    starDates: brightest.slice(i * 5, i * 5 + 5).map((d) => d.date),
  }));
}

async function main() {
  const rand = mulberry32(20260531);
  const { days, total } = buildDays(rand);

  // Replace these with your real repo names when you switch to live data,
  // or let the real fetcher fill them in automatically.
  const projectNames = ["Aurora", "Helios", "Nimbus"];

  const data = {
    schemaVersion: 1,
    user: "<YOUR_GITHUB_USERNAME>",
    generatedAt: new Date().toISOString(),
    totalContributions: total,
    isMock: true,
    days,
    languages: LANGUAGES,
    projects: buildProjects(days, projectNames),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `Wrote mock data: ${days.length} days, ${total} contributions -> ${OUT}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
