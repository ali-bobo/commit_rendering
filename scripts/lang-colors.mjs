// Single source of truth for the language → colour mapping, imported by BOTH
// data producers (generate-mock.mjs and fetch-contributions.mjs) so the legend
// palette can never drift between sample and real data. Mirrors the renderer's
// FALLBACK_COLOR. Harmonious coral→indigo ramp: distinct hues that still sit
// next to each other on the colour wheel.
export const LANG_COLORS = {
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

// Soft orchid for languages not in the map. Keep in sync with renderer.ts.
export const FALLBACK_COLOR = "#d79ad0";
