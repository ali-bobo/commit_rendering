# Commit Constellation

Turn your GitHub contributions into a drifting pink-orange nebula. Every day is a star — brighter stars are busier days, colours mark languages, and your repositories become named constellations. Updates itself daily via GitHub Actions with no server and no secrets in the browser.

<picture>
  <source srcset="public/preview.webp" type="image/webp">
  <img src="public/preview.png" alt="Animated nebula of GitHub contributions">
</picture>

![license](https://img.shields.io/badge/license-MIT-green)

> The README preview is an **animated WebP** (`public/preview.webp`) so the
> twinkle and drift show even where Canvas can't run, with `public/preview.png`
> as a still fallback. Both are regenerated daily by CI — see
> `scripts/screenshot.mjs`.

## Quick start (local, sample data)

```bash
npm install
npm run fetch:mock   # generate public/data/contributions.json (sample)
npm run dev          # open the printed localhost URL
```

## Deploy to GitHub Pages

1. Fork or push this repo to GitHub.
2. **Settings → Pages → Source = GitHub Actions**.
3. **Actions → Deploy to GitHub Pages → Run workflow**.
4. Site is live at `https://<your-username>.github.io/<repo-name>/`.

The first deploy uses sample data. To switch to your real contributions:

**Actions → Update contribution data → Run workflow**

After that the data refreshes automatically every day at UTC 04:17.

> No configuration required — your username is read from `github.repository_owner` automatically.

### Optional settings

| What | How |
|---|---|
| Include **private** contributions | Add a fine-grained PAT (read-only `Contributions` + `Metadata`) as repo secret **`CONSTELLATION_TOKEN`** |
| Choose which repos become constellations | Add repo variable **`PROJECT_REPOS`** = comma-separated names, e.g. `my-app,dotfiles` |

## How auto-update works

```
daily cron ──► update-data.yml ──► fetch-contributions.mjs ──► contributions.json (committed)
                                                                        │
                                                            workflow_run ──► deploy.yml ──► GitHub Pages
```

The token never leaves CI. The browser only fetches a static JSON file.

## Project layout

```
.
├─ index.html                      # entry + strict CSP
├─ src/
│  ├─ main.tsx, App.tsx, index.css
│  ├─ components/Constellation.tsx  # React wrapper + controls
│  └─ lib/
│     ├─ types.ts                   # data contract
│     ├─ loadData.ts                # fetch + runtime validation
│     └─ renderer.ts                # Canvas 2D renderer (reusable)
├─ scripts/
│  ├─ generate-mock.mjs             # sample data generator
│  └─ fetch-contributions.mjs       # real GitHub data fetcher
├─ public/data/contributions.json   # generated; committed by CI
├─ .github/
│  ├─ workflows/update-data.yml
│  ├─ workflows/deploy.yml
│  └─ dependabot.yml
└─ SECURITY.md
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Strict TypeScript check |
| `npm run fetch:mock` | Generate sample data |
| `npm run fetch:data` | Fetch real data (needs `GITHUB_TOKEN` + `GITHUB_USER`) |

## License

MIT — see `LICENSE`.
