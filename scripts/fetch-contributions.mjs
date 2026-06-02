// Fetches ALL years of contribution data from the GitHub GraphQL API and writes
// per-year files plus an index to public/data/.
//
// Output:
//   public/data/index.json               – lists available years, newest first
//   public/data/contributions-YYYY.json  – per-year data (schemaVersion 1)
//
// Run locally:  GITHUB_TOKEN=ghp_xxx GITHUB_USER=yourname npm run fetch:data
// In CI:        provided by .github/workflows/update-data.yml
//
// SECURITY: the token is read ONLY from the environment. It is never written
// into the output files and never reaches the browser. The output JSON contains
// only public-looking aggregate counts, language names, and dates.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../public/data");

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USER;
// Comma-separated repo names to turn into named constellations, e.g.
// PROJECT_REPOS="my-app,dotfiles,blog". If empty, top repos by activity are used.
const PROJECT_REPOS = (process.env.PROJECT_REPOS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Maximum number of repos to show as named constellations (when PROJECT_REPOS is empty).
const MAX_PROJECTS = 8;

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN environment variable.");
  process.exit(1);
}
if (!USER) {
  console.error("Missing GITHUB_USER environment variable.");
  process.exit(1);
}

// Harmonious coral→indigo ramp: cohesive neighbours on the colour wheel rather
// than a flat warm wash. Keep in sync with scripts/generate-mock.mjs and the
// renderer's FALLBACK_COLOR. Languages not listed fall back to a soft orchid.
const LANG_COLORS = {
  TypeScript: "#6c7bff",
  JavaScript: "#ff9e7a",
  Python: "#c563dc",
  Rust: "#ff6f9c",
  Go: "#7b86ff",
  GLSL: "#db61c8",
  C: "#ff8d7e",
  "C++": "#ff7d8e",
  Java: "#fa66ad",
  Ruby: "#ad66ec",
  Shell: "#ec64bb",
  HTML: "#9b6cff",
  CSS: "#8a78ff",
};
const FALLBACK_COLOR = "#d79ad0";

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

// Fetch user's creation date + repo list.
// Uses aliased contributions fields to get both total count and recent commit
// dates per repo — the dates are later used to build per-project constellations.
const USER_QUERY = `
query($login: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 50) {
        repository {
          name
          primaryLanguage { name }
          isFork
        }
        allCommits: contributions {
          totalCount
        }
        recentDates: contributions(last: 7) {
          nodes { occurredAt }
        }
      }
    }
  }
}`;

// Fetch contributions for a specific date range (at most 1 year per call).
const YEAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

async function fetchYear(year, primaryLang) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;
  const data = await gql(YEAR_QUERY, { login: USER, from, to });
  const cal = data.user.contributionsCollection.contributionCalendar;

  const days = [];
  for (const week of cal.weeks) {
    for (const d of week.contributionDays) {
      days.push({
        date: d.date,
        count: d.contributionCount,
        language: d.contributionCount > 0 ? primaryLang : null,
      });
    }
  }
  return { days, total: cal.totalContributions };
}

async function main() {
  // 1. Get account creation year + current repo list with per-repo top dates.
  const userData = await gql(USER_QUERY, { login: USER });
  const creationYear = new Date(userData.user.createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  const repos = userData.user.contributionsCollection.commitContributionsByRepository
    .filter((r) => !r.repository.isFork)
    .map((r) => ({
      name: r.repository.name,
      lang: r.repository.primaryLanguage?.name ?? null,
      total: r.allCommits.totalCount,
      // ISO dates (YYYY-MM-DD) of the most recent commits in each repo.
      topDates: r.recentDates.nodes.map((n) => n.occurredAt.slice(0, 10)),
    }))
    .sort((a, b) => b.total - a.total);

  // Build a fast lookup: repo name → its most-recently-active dates.
  const repoTopDates = new Map(repos.map((r) => [r.name, r.topDates]));

  const primaryLang = repos.find((r) => r.lang)?.lang ?? null;

  const langSet = new Set(
    repos
      .filter((r) => r.lang)
      .slice(0, 6)
      .map((r) => r.lang)
  );
  const languages = [...langSet].map((name) => ({
    name,
    color: LANG_COLORS[name] ?? FALLBACK_COLOR,
  }));
  if (languages.length === 0) {
    languages.push({ name: "Other", color: FALLBACK_COLOR });
  }

  // 2. Determine which repos become named constellations.
  const chosen =
    PROJECT_REPOS.length > 0
      ? PROJECT_REPOS
      : repos.slice(0, MAX_PROJECTS).map((r) => r.name);

  console.log(`Projects: ${chosen.join(", ")}`);

  // 3. Fetch each year from account creation to now (newest first).
  const years = [];
  for (let y = currentYear; y >= creationYear; y--) {
    years.push(y);
  }

  await mkdir(DATA_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  for (const year of years) {
    const { days, total } = await fetchYear(year, primaryLang);

    // For projects: prefer this repo's own commit dates that fall in this year.
    // If a repo has fewer than 3 matching dates, fall back to the global brightest
    // days for that year (distributed round-robin across projects).
    const brightest = [...days]
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const projects = chosen.map((name, i) => {
      const allRepoDates = repoTopDates.get(name) ?? [];
      const yearDates = allRepoDates.filter((d) => d.startsWith(`${year}-`));
      const starDates =
        yearDates.length >= 3
          ? yearDates.slice(0, 5)
          : brightest.slice(i * 5, i * 5 + 5).map((d) => d.date);
      return { name, starDates };
    });

    const out = {
      schemaVersion: 1,
      user: USER,
      generatedAt,
      year,
      totalContributions: total,
      isMock: false,
      days,
      languages,
      projects,
    };

    const outPath = resolve(DATA_DIR, `contributions-${year}.json`);
    await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(
      `Year ${year}: ${days.length} days, ${total} contributions -> ${outPath}`
    );
  }

  // 4. Write index.json listing all years (newest first).
  const index = {
    schemaVersion: 1,
    user: USER,
    generatedAt,
    years,
  };
  const indexPath = resolve(DATA_DIR, "index.json");
  await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`Wrote index.json: years [${years.join(", ")}] -> ${indexPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
