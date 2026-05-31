import type { ConstellationData, YearIndex } from "./types";

/** CSS hex colour: #rgb, #rrggbb, #rrggbbaa, etc. Prevents CSS injection via inline styles. */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
/** ISO date YYYY-MM-DD. Prevents NaN from bad dates breaking renderer month grouping. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Runtime guard so a malformed JSON fails loudly instead of rendering garbage. */
function isConstellationData(x: unknown): x is ConstellationData {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  if (
    d.schemaVersion !== 1 ||
    typeof d.user !== "string" ||
    d.user.length > 100 ||
    !Array.isArray(d.days) ||
    !Array.isArray(d.languages) ||
    !Array.isArray(d.projects)
  ) {
    return false;
  }
  // Optional year field — must be a plausible calendar year if present.
  if (
    typeof d.year !== "undefined" &&
    (typeof d.year !== "number" ||
      !Number.isInteger(d.year) ||
      d.year < 2008 ||
      d.year > 2100)
  ) {
    return false;
  }
  // Validate each day entry.
  for (const day of d.days as unknown[]) {
    if (!day || typeof day !== "object") return false;
    const s = day as Record<string, unknown>;
    if (
      typeof s.date !== "string" ||
      !ISO_DATE_RE.test(s.date) ||
      typeof s.count !== "number" ||
      s.count < 0 ||
      !Number.isFinite(s.count) ||
      (s.language !== null &&
        (typeof s.language !== "string" || s.language.length > 80))
    ) {
      return false;
    }
  }
  // Validate each language entry — colour is used in inline styles.
  for (const lang of d.languages as unknown[]) {
    if (!lang || typeof lang !== "object") return false;
    const l = lang as Record<string, unknown>;
    if (
      typeof l.name !== "string" ||
      l.name.length > 80 ||
      typeof l.color !== "string" ||
      !HEX_COLOR_RE.test(l.color)
    ) {
      return false;
    }
  }
  // Validate each project entry.
  for (const proj of d.projects as unknown[]) {
    if (!proj || typeof proj !== "object") return false;
    const p = proj as Record<string, unknown>;
    if (
      typeof p.name !== "string" ||
      p.name.length > 200 ||
      !Array.isArray(p.starDates) ||
      (p.starDates as unknown[]).some((sd) => typeof sd !== "string")
    ) {
      return false;
    }
  }
  return true;
}

export async function loadConstellationData(
  url: string
): Promise<ConstellationData> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  if (!isConstellationData(json)) {
    throw new Error(
      `Data at ${url} does not match the expected schema (schemaVersion 1).`
    );
  }
  return json;
}

function isYearIndex(x: unknown): x is YearIndex {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  return (
    d.schemaVersion === 1 &&
    typeof d.user === "string" &&
    d.user.length <= 100 &&
    typeof d.generatedAt === "string" &&
    Array.isArray(d.years) &&
    (d.years as unknown[]).every(
      (y) =>
        typeof y === "number" &&
        Number.isInteger(y) &&
        y >= 2008 &&
        y <= 2100
    )
  );
}

export async function loadYearIndex(url: string): Promise<YearIndex> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  if (!isYearIndex(json)) {
    throw new Error(
      `Data at ${url} does not match the expected YearIndex schema.`
    );
  }
  return json;
}
