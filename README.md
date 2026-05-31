# Commit Constellation

Turn your GitHub contributions into a drifting pink-orange nebula. Every day is
a star — brighter stars are busier days, colours mark languages, and your
repositories become named constellations. It updates itself daily from the
GitHub API, with no server and no secrets in the browser.

![status](https://img.shields.io/badge/build-vite-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Quick start (sample data)

```bash
npm install
npm run fetch:mock     # generates public/data/contributions.json (sample)
npm run dev            # open the printed localhost URL
```

You'll see the full visualization running on sample data immediately.

## Go live with your real GitHub data

You have two options.

### Option A — automatic, in GitHub Actions (recommended)

1. Create a repo named exactly **`<your-username>`** *or* any repo with Pages
   enabled.
2. Push this project to it.
3. In repo **Settings → Pages**, set **Source = GitHub Actions**.
4. (Optional) To show **private** contributions, create a fine-grained PAT with
   read-only **Contributions** + **Metadata** access and save it as repo secret
   **`CONSTELLATION_TOKEN`**. Public-only needs nothing — the built-in token
   works.
5. (Optional) In **Settings → Secrets and variables → Actions → Variables**, set
   **`PROJECT_REPOS`** to a comma-separated list of repo names for your named
   constellations, e.g. `my-app,dotfiles,blog`. Leave unset to auto-pick.
6. Trigger the **Update contribution data** workflow once (Actions tab → Run
   workflow). It fetches your data, commits `contributions.json`, and the
   **Deploy** workflow publishes the site. After that it refreshes daily.

The username is taken automatically from the repo owner — no editing required.

### Option B — generate data locally, then deploy

```bash
cp .env.example .env       # fill in GITHUB_TOKEN and GITHUB_USER
# (PROJECT_REPOS optional)
set -a; source .env; set +a
npm run fetch:data         # writes real data into public/data/contributions.json
npm run build              # output in dist/
```

Then deploy `dist/` however you like (the included workflow does this for you).

## How auto-update works

```
daily cron ─► update-data.yml ─► fetch-contributions.mjs ─► contributions.json (committed)
                                                                   │
                                                       push ─► deploy.yml ─► GitHub Pages
```

Everything runs on GitHub's runners. The token never leaves CI; the browser
only ever fetches a static JSON file. See `SECURITY.md`.

## Reusing it in your portfolio

The renderer in `src/lib/renderer.ts` is framework-agnostic — it takes a canvas
and a `ConstellationData` object. To embed in your portfolio, copy
`renderer.ts` + `types.ts`, point it at your data file, and mount it on a
canvas (the React wrapper in `src/components/Constellation.tsx` shows how).

## Project layout

```
.
├─ index.html                     # entry + strict CSP
├─ src/
│  ├─ main.tsx, App.tsx, index.css
│  ├─ components/Constellation.tsx # React wrapper + controls
│  └─ lib/
│     ├─ types.ts                  # the data contract
│     ├─ loadData.ts               # fetch + runtime validation
│     └─ renderer.ts               # Canvas 2D renderer (reusable)
├─ scripts/
│  ├─ generate-mock.mjs            # sample data
│  └─ fetch-contributions.mjs      # real GitHub data
├─ public/data/contributions.json  # generated; read by the app
├─ .github/
│  ├─ workflows/{update-data,deploy}.yml
│  └─ dependabot.yml
├─ .claude/{CLAUDE.md,settings.json}
├─ SPEC.md, SECURITY.md
└─ ...config
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Strict TypeScript check |
| `npm run fetch:mock` | Generate sample data |
| `npm run fetch:data` | Fetch real data (needs env vars) |

## License

MIT — see `LICENSE`.
