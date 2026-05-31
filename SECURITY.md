# Security model

This project is a static site that visualises public GitHub contribution data.
The design goal is: **no server, no secrets in the browser, minimal trust.**

## Where the token lives (and doesn't)

- The GitHub token is used **only** inside the `update-data` GitHub Actions job,
  read from `secrets.GITHUB_TOKEN` (auto-provided, repo-scoped) or your own
  `CONSTELLATION_TOKEN` secret.
- It is **never** written into `public/data/contributions.json`, never logged,
  and never shipped to the browser.
- The deployed frontend makes exactly one network request: a `fetch` of the
  local `contributions.json`. That is enforced by the CSP `connect-src 'self'`.

## What the published data contains

Only aggregate, non-sensitive values: per-day contribution counts, language
names, ISO dates, your username, and chosen repo names. No emails, no tokens,
no private file contents.

## Content Security Policy

`index.html` ships a strict CSP:

```
default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none';
frame-ancestors 'none'
```

`style-src 'unsafe-inline'` is required because the renderer sets inline styles
on the tooltip. There is no inline or third-party JavaScript.

## GitHub Actions hardening

- **Least privilege.** `update-data` requests `contents: write` only.
  `deploy` requests only the Pages trio (`pages: write`, `id-token: write`,
  `contents: read`). Do not broaden these.
- **First-party actions** (`actions/checkout`, `actions/setup-node`,
  `actions/configure-pages`, `actions/upload-pages-artifact`,
  `actions/deploy-pages`) are pinned to major version tags.
- **Third-party actions: pin to a full commit SHA, never a tag.** Tag-pinning
  is what enabled the CVE-2025-30066 `tj-actions/changed-files` supply-chain
  attack that affected tens of thousands of repos. This project currently uses
  no third-party actions; if you add one, pin it like:
  `some/action@<40-char-sha> # v1.2.3`.

### Recommended: upgrade first-party actions to SHA pins too

Major-tag pins are convenient but mutable. For maximum supply-chain safety,
replace each `actions/foo@v4` with its commit SHA. To find the SHA:

```bash
gh api repos/actions/checkout/git/refs/tags/v4 --jq '.object.sha'
```

(annotated tags may need a second deref via the returned object URL). Then:
`uses: actions/checkout@<sha> # v4`. Dependabot (configured in
`.github/dependabot.yml`) will keep SHA pins updated.

## Dependencies

Runtime deps are intentionally limited to React. Dev deps are Vite + TypeScript.
`npm ci` uses the committed lockfile. Dependabot opens weekly update PRs for npm
and Actions. Run `npm audit` before releases.

## Reporting

This is a personal project; open a private issue or contact the repo owner.
