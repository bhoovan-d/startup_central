/**
 * The categorical chart palette.
 *
 * These values are NOT a matter of taste — they were produced by running
 * `dataviz/scripts/validate_palette.js` and iterating until all five checks
 * passed in both modes:
 *
 *   light  (surface #FAF7F0)  lightness band · chroma floor · CVD separation
 *                             · normal-vision floor · contrast  — ALL PASS
 *   dark   (surface #14110F)  same five                          — ALL PASS
 *
 * Two rules that fall out of that validation and are NOT optional:
 *
 *  1. ORDER IS LOAD-BEARING. An earlier ordering placed marigold adjacent to
 *     emerald and dropped colourblind separation into the warning band.
 *     Do not reorder these slots.
 *
 *  2. Dark mode's emerald↔vermillion pair sits at tritan ΔE 6.0 — inside the
 *     6–8 floor band, which is legal ONLY with secondary encoding. Every chart
 *     using this palette must therefore also carry direct labels and the 2px
 *     surface gap between fills. Colour is never the only cue.
 *
 * Brand marigold (#F2A20C) is deliberately absent: it fails the 3:1 contrast
 * floor against paper. It is a UI colour only. Charts use slot 5 instead.
 *
 * Re-run the validator before changing any value here.
 */

export const CHART_PALETTE_LIGHT = [
  "#3D5AE0", // 1 indigo-blue
  "#D93A1E", // 2 vermillion
  "#0F9268", // 3 emerald
  "#A8309B", // 4 plum
  "#C57F00", // 5 marigold (chart-safe; not the brand value)
  "#1580AE", // 6 sky
  "#6F8F14", // 7 moss
  "#C9186B", // 8 pink
] as const;

export const CHART_PALETTE_DARK = [
  "#6C86F5",
  "#E8563C",
  "#21A87A",
  "#CE5CBC",
  "#BD870A",
  "#3195C6",
  "#7B992A",
  "#EE5390",
] as const;

export const CHART_SLOTS = 8;

/**
 * CSS custom property for a slot. Prefer this over a raw hex in components —
 * it resolves to the correct mode automatically via globals.css.
 *
 * Colour follows the ENTITY, never its rank. Pass a stable per-entity slot
 * (e.g. `tags.colorSlot`), not an array index — otherwise filtering the chart
 * repaints the surviving series, which is the single most common chart bug.
 */
export function chartVar(slot: number): string {
  const n = ((slot % CHART_SLOTS) + CHART_SLOTS) % CHART_SLOTS;
  return `var(--chart-${n + 1})`;
}

/** Status colours are reserved and never reused as an extra series. */
export const STATUS_COLORS = {
  good: "var(--color-good)",
  warning: "var(--color-warning)",
  serious: "var(--color-serious)",
  critical: "var(--color-critical)",
} as const;
