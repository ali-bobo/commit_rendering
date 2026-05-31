// Generates mock contribution data matching the data contract in
// src/lib/types.ts and writes per-year files + an index to public/data/.
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
const DATA_DIR = resolve(__dirname, "../public/data");

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

/** Build mock days for a specific calendar year.
 *  For the current year, stops at today to match real data behaviour. */
function buildDaysForYear(rand, year) {
  const days = [];
  const today = new Date();
  const start = new Date(year, 0, 1); // Jan 1
  const end =
    year === today.getFullYear()
      ? today
      : new Date(year, 11, 31); // Dec 31

  let total = 0;
  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    // Bias toward fewer commits, occasional bright bursts.
    const base = Math.pow(rand(), 2.4);
    const burst = rand() > 0.92 ? rand() * 0.6 : 0;
    const count = Math.floor((base + burst) * 15);
    total += count;

    // Pick a language; monthly "main" language gives some clustering.
    const monthMain = (d.getMonth() * 7) % LANGUAGES.length;
    const langIdx =
      rand() < 0.7 ? monthMain : Math.floor(rand() * LANGUAGES.length);

    days.push({
      date: isoDate(new Date(d)),
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
  const currentYear = new Date().getFullYear();
  // Generate 3 years of mock data so the year-selector is visible.
  const mockYears = [currentYear, currentYear - 1, currentYear - 2];

  const projectNames = ["Aurora", "Helios", "Nimbus"];
  const generatedAt = new Date().toISOString();

  await mkdir(DATA_DIR, { recursive: true });

  for (const year of mockYears) {
    // Use a deterministic seed derived from the year.
    const rand = mulberry32(year * 1000 + 42);
    const { days, total } = buildDaysForYear(rand, year);

    const data = {
      schemaVersion: 1,
      user: "<YOUR_GITHUB_USERNAME>",
      generatedAt,
      year,
      totalContributions: total,
      isMock: true,
      days,
      languages: LANGUAGES,
      projects: buildProjects(days, projectNames),
    };

    const outPath = resolve(DATA_DIR, `contributions-${year}.json`);
    await writeFile(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(
      `Wrote mock data for ${year}: ${days.length} days, ${total} contributions -> ${outPath}`
    );
  }

  // Write index.json.
  const index = {
    schemaVersion: 1,
    user: "<YOUR_GITHUB_USERNAME>",
    generatedAt,
    years: mockYears,
  };
  const indexPath = resolve(DATA_DIR, "index.json");
  await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`Wrote mock index.json -> ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
