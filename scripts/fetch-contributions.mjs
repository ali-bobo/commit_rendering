// Fetches REAL contribution data from the GitHub GraphQL API and writes it to
// public/data/contributions.json, matching the data contract in src/lib/types.ts.
//
// Run locally:  GITHUB_TOKEN=ghp_xxx GITHUB_USER=yourname npm run fetch:data
// In CI:        provided by .github/workflows/update-data.yml
//
// SECURITY: the token is read ONLY from the environment. It is never written
// into the output file and never reaches the browser. The output JSON contains
// only public-looking aggregate counts, language names, and dates.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data/contributions.json");

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USER;
// Comma-separated repo names to turn into named constellations, e.g.
// PROJECT_REPOS="my-app,dotfiles,blog". If empty, the top repos by recent
// activity are used.
const PROJECT_REPOS = (process.env.PROJECT_REPOS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN environment variable.");
  process.exit(1);
}
if (!USER) {
  console.error("Missing GITHUB_USER environment variable.");
  process.exit(1);
}

// Pink-orange palette. Languages not listed fall back to a neutral warm tone.
const LANG_COLORS = {
  TypeScript: "#ff9e7a",
  JavaScript: "#ffd9b0",
  Python: "#ffcaa0",
  Rust: "#ff7a9e",
  Go: "#ffb0d0",
  GLSL: "#ffd9b0",
  C: "#ff9e7a",
  "C++": "#ff8d6b",
  Java: "#ffb98a",
  Ruby: "#ff7a9e",
  Shell: "#ffcaa0",
  HTML: "#ffb0d0",
  CSS: "#ffd9b0",
};
const FALLBACK_COLOR = "#ffc6a0";

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "commit-constellation",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const CONTRIB_QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 50) {
        repository {
          name
          primaryLanguage { name }
        }
        contributions { totalCount }
      }
    }
  }
}`;

async function main() {
  const data = await gql(CONTRIB_QUERY, { login: USER });
  const cc = data.user.contributionsCollection;
  const cal = cc.contributionCalendar;

  // Flatten calendar into the day list.
  const days = [];
  for (const week of cal.weeks) {
    for (const d of week.contributionDays) {
      days.push({ date: d.date, count: d.contributionCount, language: null });
    }
  }

  // Determine the user's primary language overall (used as a coarse per-day
  // label, since GitHub's calendar API does not break contributions down by
  // language per day). Repos are ranked by contribution volume.
  const repos = cc.commitContributionsByRepository
    .map((r) => ({
      name: r.repository.name,
      lang: r.repository.primaryLanguage?.name ?? null,
      total: r.contributions.totalCount,
    }))
    .sort((a, b) => b.total - a.total);

  const primaryLang = repos.find((r) => r.lang)?.lang ?? null;
  for (const day of days) {
    if (day.count > 0) day.language = primaryLang;
  }

  // Build the language legend from the languages that actually appear.
  const langSet = new Set();
  for (const r of repos) if (r.lang) langSet.add(r.lang);
  if (primaryLang) langSet.add(primaryLang);
  const languages = [...langSet].slice(0, 6).map((name) => ({
    name,
    color: LANG_COLORS[name] ?? FALLBACK_COLOR,
  }));
  if (languages.length === 0) {
    languages.push({ name: "Other", color: FALLBACK_COLOR });
  }

  // Choose which repos become named constellations.
  const chosen =
    PROJECT_REPOS.length > 0
      ? PROJECT_REPOS
      : repos.slice(0, 3).map((r) => r.name);

  // For each chosen project, pick its constellation stars as the brightest
  // contribution days overall, partitioned so the constellations don't overlap.
  const brightest = [...days]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const projects = chosen.map((name, i) => ({
    name,
    starDates: brightest.slice(i * 5, i * 5 + 5).map((d) => d.date),
  }));

  const out = {
    schemaVersion: 1,
    user: USER,
    generatedAt: new Date().toISOString(),
    totalContributions: cal.totalContributions,
    isMock: false,
    days,
    languages,
    projects,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `Wrote real data for ${USER}: ${days.length} days, ` +
      `${cal.totalContributions} contributions -> ${OUT}`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
