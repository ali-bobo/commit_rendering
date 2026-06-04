/**
 * The data contract.
 *
 * This is the ONLY shape the frontend depends on. Both the mock generator
 * (scripts/generate-mock.mjs) and the real fetcher (scripts/fetch-contributions.mjs)
 * emit one file per year matching `ConstellationData` to
 * public/data/contributions-YYYY.json, plus an index.json (`YearIndex`).
 *
 * Because both producers honour this contract, swapping mock data for real
 * GitHub data requires ZERO frontend changes.
 */

/** One day = one star. */
export interface DayStar {
  /** ISO date, e.g. "2026-05-31". */
  date: string;
  /** Contribution/commit count that day. Drives the star's magnitude. */
  count: number;
  /** Dominant language that day (or null if unknown). Drives the star's colour. */
  language: string | null;
}

/** A named constellation built from one of your real repositories. */
export interface ProjectConstellation {
  /** Display name (your repo name). */
  name: string;
  /**
   * ISO dates of the stars that form this constellation's line, in draw order.
   * Each date must also appear in `days`. Typically the highest-activity days
   * for that project, or hand-picked.
   */
  starDates: string[];
}

/** Legend entry mapping a language to a colour in the pink-orange ramp. */
export interface LanguageColor {
  name: string;
  /** CSS hex colour, e.g. "#ff9e7a". */
  color: string;
}

export interface ConstellationData {
  /** Schema version, so the frontend can guard against breaking changes. */
  schemaVersion: 1;
  /** GitHub username this data belongs to. */
  user: string;
  /** ISO timestamp this file was generated. */
  generatedAt: string;
  /** Calendar year this data covers (YYYY). Present in per-year files. */
  year?: number;
  /** Total contributions in the covered window. */
  totalContributions: number;
  /** Whether this is mock data (true) or real GitHub data (false). */
  isMock: boolean;
  /** Every day in the window, oldest first. */
  days: DayStar[];
  /** Language → colour legend. */
  languages: LanguageColor[];
  /** Named constellations from your projects. */
  projects: ProjectConstellation[];
}

/** Index listing all available years of contribution data. */
export interface YearIndex {
  schemaVersion: 1;
  user: string;
  generatedAt: string;
  /** Available years, newest first. */
  years: number[];
}
