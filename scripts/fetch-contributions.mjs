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
import { LANG_COLORS, FALLBACK_COLOR } from "./lang-colors.mjs";

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

// Language → colour mapping lives in scripts/lang-colors.mjs (shared with the
// mock generator) so the palette can never drift between sample and real data.

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
    id
    createdAt
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 50) {
        repository {
          name
          nameWithOwner
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

// Owned, non-fork repos with their primary language. The contributions query
// above only sees repos touched in the last year, so this fills in older repos
// whose commit history still carries language signal for past years.
const OWNED_REPOS_QUERY = `
query($login: String!, $cursor: String) {
  user(login: $login) {
    repositories(
      first: 100
      after: $cursor
      isFork: false
      ownerAffiliations: [OWNER]
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        primaryLanguage { name }
      }
    }
  }
}`;

// The user's own commits in one repo over a window, by date. Filtered to the
// user (author id) so co-contributors' commits never colour the user's days.
// We read ONLY committedDate — never message, diff, or any code content.
const HISTORY_QUERY = `
query($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(author: { id: $author }, since: $since, until: $until, first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate }
          }
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

async function fetchYear(year, dateLang, fallbackLang) {
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
        // Per-day dominant language from commit attribution; days with activity
        // but no attributable commit (PRs/issues/reviews, or commits outside the
        // scanned repos) fall back to the account's overall primary language.
        language:
          d.contributionCount > 0
            ? dateLang.get(d.date) ?? fallbackLang
            : null,
      });
    }
  }
  return { days, total: cal.totalContributions };
}

// Page through one repo's commit history (user-authored only) and return the
// ISO dates (YYYY-MM-DD) those commits landed on. Bounded so a huge repo can't
// run the job away.
async function fetchRepoCommitDates(owner, name, author, since, until) {
  const MAX_PAGES = 60; // up to 6000 commits per repo
  const dates = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await gql(HISTORY_QUERY, {
      owner,
      name,
      author,
      since,
      until,
      cursor,
    });
    const hist = data.repository?.defaultBranchRef?.target?.history;
    if (!hist) break; // empty repo / no default branch
    for (const n of hist.nodes) dates.push(n.committedDate.slice(0, 10));
    if (!hist.pageInfo.hasNextPage) break;
    cursor = hist.pageInfo.endCursor;
  }
  return dates;
}

// Build date -> dominant language by attributing each user commit to its repo's
// primary language. Returns the per-day map plus a language→day-count tally used
// to build a legend that actually reflects what is drawn.
async function buildDateLang(repos, author, since, until) {
  const perDate = new Map(); // date -> Map(lang -> commit count)
  for (const r of repos) {
    if (!r.lang || !r.owner || !r.name) continue;
    let dates;
    try {
      dates = await fetchRepoCommitDates(r.owner, r.name, author, since, until);
    } catch (e) {
      console.warn(`  ! history skipped for ${r.owner}/${r.name}: ${e.message}`);
      continue;
    }
    for (const d of dates) {
      let m = perDate.get(d);
      if (!m) {
        m = new Map();
        perDate.set(d, m);
      }
      m.set(r.lang, (m.get(r.lang) || 0) + 1);
    }
  }

  const dateLang = new Map();
  const langDays = new Map(); // lang -> number of days where it dominates
  for (const [date, m] of perDate) {
    let best = null;
    let bestN = -1;
    for (const [lang, n] of m) {
      if (n > bestN) {
        best = lang;
        bestN = n;
      }
    }
    dateLang.set(date, best);
    langDays.set(best, (langDays.get(best) || 0) + 1);
  }
  return { dateLang, langDays };
}

// All owned non-fork repos (paged), so older years still get language signal.
async function fetchOwnedRepos() {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    const data = await gql(OWNED_REPOS_QUERY, { login: USER, cursor });
    const conn = data.user.repositories;
    for (const n of conn.nodes) {
      out.push({ nameWithOwner: n.nameWithOwner, lang: n.primaryLanguage?.name ?? null });
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return out;
}

async function main() {
  // 1. Get account creation year + current repo list with per-repo top dates.
  const userData = await gql(USER_QUERY, { login: USER });
  const userId = userData.user.id;
  const creationYear = new Date(userData.user.createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  const repos = userData.user.contributionsCollection.commitContributionsByRepository
    .filter((r) => !r.repository.isFork)
    .map((r) => ({
      name: r.repository.name,
      nameWithOwner: r.repository.nameWithOwner,
      lang: r.repository.primaryLanguage?.name ?? null,
      total: r.allCommits.totalCount,
      // ISO dates (YYYY-MM-DD) of the most recent commits in each repo.
      topDates: r.recentDates.nodes.map((n) => n.occurredAt.slice(0, 10)),
    }))
    .sort((a, b) => b.total - a.total);

  // Build a fast lookup: repo name → its most-recently-active dates.
  const repoTopDates = new Map(repos.map((r) => [r.name, r.topDates]));

  const primaryLang = repos.find((r) => r.lang)?.lang ?? null;

  // 1b. Per-day language attribution. Union the repos the user has committed to
  // recently (above) with all owned repos (for older years), then read each
  // repo's user-authored commit dates and tag each day by its repo's language.
  const owned = await fetchOwnedRepos();
  const attribByNwo = new Map();
  for (const r of repos) {
    if (r.nameWithOwner) attribByNwo.set(r.nameWithOwner, r.lang);
  }
  for (const r of owned) attribByNwo.set(r.nameWithOwner, r.lang);
  const attribRepos = [...attribByNwo.entries()].map(([nwo, lang]) => {
    const [owner, name] = nwo.split("/");
    return { owner, name, lang };
  });

  const since = `${creationYear}-01-01T00:00:00Z`;
  const until = new Date().toISOString();
  console.log(`Attributing languages across ${attribRepos.length} repos…`);
  const { dateLang, langDays } = await buildDateLang(
    attribRepos,
    userId,
    since,
    until
  );

  // Legend reflects what is actually drawn: languages ordered by how many days
  // they dominate, capped, mapped to the shared palette.
  const languages = [...langDays.entries()]
    .filter(([name]) => name)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => ({ name, color: LANG_COLORS[name] ?? FALLBACK_COLOR }));
  if (primaryLang && !languages.some((l) => l.name === primaryLang)) {
    languages.unshift({
      name: primaryLang,
      color: LANG_COLORS[primaryLang] ?? FALLBACK_COLOR,
    });
  }
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
    const { days, total } = await fetchYear(year, dateLang, primaryLang);

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
