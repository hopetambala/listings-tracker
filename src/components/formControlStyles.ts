import type { CSSProperties } from "react";

/**
 * Standardized heights / radii / fonts for form controls so native inputs,
 * selects, and date pickers all line up with the rest of the UI.
 */
const BASE_HEIGHT = "2.25rem";
const BASE_RADIUS = "0.5rem";

export const controlBase: CSSProperties = {
  height: BASE_HEIGHT,
  padding: "0 0.75rem",
  border: "1px solid #e5e7eb",
  borderRadius: BASE_RADIUS,
  fontSize: "0.875rem",
  background: "white",
  boxSizing: "border-box",
  color: "#0f172a",
  fontFamily: "inherit",
};

// Inline SVG chevron for selects and date pickers.
const CHEVRON_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%23475569' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>";

export const selectBase: CSSProperties = {
  ...controlBase,
  paddingRight: "2rem",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage: `url("${CHEVRON_SVG}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.625rem center",
};

export const smallControlBase: CSSProperties = {
  ...controlBase,
  height: "2rem",
  fontSize: "0.8125rem",
};

export const smallSelectBase: CSSProperties = {
  ...selectBase,
  height: "2rem",
  fontSize: "0.8125rem",
};
