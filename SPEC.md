# Commit Constellation — specification

## 1. Concept

Render a GitHub user's last 365 days of contributions as an animated nebula
star map on an HTML Canvas:

- **One day → one star.**
- **Magnitude** (radius + glow + twinkle) ∝ that day's contribution count.
- **Colour** encodes the day's dominant programming language (pink-orange ramp).
- Days are threaded chronologically along a **galaxy arc** (Jan→Dec), with month
  labels anchored along it.
- Each active day is attributed to one of the user's real repositories; that
  **project** is surfaced on hover (no drawn constellation lines — an earlier
  line-drawing version was removed for being visually noisy).
- Ambient touches: drifting stars, twinkling, periodic **meteors**, and an
  optional **mouse-gravity** effect.
- Hovering a star shows a tooltip: `N commits · M月D日 · Language · ✦ Project`.

Default state is calm (slow drift, gentle twinkle) to avoid eye strain;
heavier motion only happens on interaction.

## 2. Architecture

```
GitHub GraphQL API
        │  (CI only, token in env)
        ▼
scripts/fetch-contributions.mjs ──► public/data/index.json          ◄── scripts/generate-mock.mjs
                                     public/data/contributions-YYYY.json
                                              │  (the data contract, one file per year)
                                              ▼
                                    src/lib/loadData.ts (fetch + validate)
                                              ▼
                          src/lib/renderer.ts  (Canvas 2D, framework-agnostic)
                                              ▼
                       src/components/Constellation.tsx  (React wrapper + UI)
                                              ▼
                                        src/App.tsx
```

The renderer is deliberately framework-agnostic so it can be lifted into the
portfolio site later with only a thin wrapper.

## 3. Data contract

Defined in `src/lib/types.ts` as `ConstellationData` (schemaVersion 1). Key
fields:

| Field | Meaning |
|---|---|
| `days[]` | `{ date, count, language }` — one entry per day |
| `languages[]` | `{ name, color }` legend |
| `projects[]` | `{ name, starDates[] }` named constellations |
| `user`, `totalContributions`, `generatedAt`, `isMock` | metadata |

Both data producers MUST emit this exact shape. The frontend imports the type
and validates at runtime in `loadData.ts`. Data is split one file per year
(`contributions-YYYY.json`); `index.json` (the `YearIndex` type) lists available
years so the UI can offer a year selector.

## 4. Auto-update mechanism

1. `update-data.yml` runs daily (cron) and on demand.
2. It runs `fetch-contributions.mjs` with a repo-scoped token from the env.
3. The script queries the GitHub GraphQL `contributionsCollection` and writes
   `public/data/contributions.json`.
4. If the file changed, the job commits it back to `main`.
5. The commit triggers `deploy.yml`, which builds and publishes to Pages.

No server is involved; all computation happens in CI on GitHub's runners.

## 5. Language → colour mapping

The fetcher maps common languages to the pink-orange ramp (`#ff7a9e`–`#ffd9b0`),
falling back to `#ffc6a0`. The GitHub calendar API does not break contributions
down by language per day, so each active day is labelled with the user's
overall primary language (by contribution volume). This is a known
approximation; see §8.

## 6. Constellations

Chosen repos (via `PROJECT_REPOS`, else top repos by activity) each become a
named **project** whose stars are the brightest contribution days, partitioned
so projects don't share stars. `starDates` reference dates that also exist in
`days`, and the project name is shown when hovering one of those stars.

## 7. Accessibility & performance

- Honours `prefers-reduced-motion` (disables drift + meteors).
- Canvas caps device pixel ratio at 2 for performance.
- Single `requestAnimationFrame` loop; no per-frame allocations in hot paths
  beyond gradient creation (acceptable at this star count).
- Target: smooth 60fps for ~365 stars + 170 background stars on a laptop.

## 8. Known limitations / future work

- **Per-day language is approximate** (see §5). A precise version would query
  per-repo commit history per day — heavier and rate-limit sensitive; out of
  scope for v1.
- WebGPU/3D is intentionally **not** used; the 2D nebula was the approved
  direction. The renderer could later gain a 3D mode behind feature detection.
- Private contributions require a fine-grained PAT (`CONSTELLATION_TOKEN`).

## 9. Acceptance criteria

- `npm install && npm run fetch:mock && npm run build` succeeds from a clean
  checkout.
- `npm run dev` renders the nebula with mock data; hovering shows tooltips;
  toggles and the drift slider work.
- `npm run typecheck` is clean under strict mode.
- No secrets present anywhere in the repo.
- Swapping mock → real data requires no frontend code changes.
