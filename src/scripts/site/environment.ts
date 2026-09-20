// Shared browser state for the site enhancements, initialized once per page.
export const root = document.documentElement;
export const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
