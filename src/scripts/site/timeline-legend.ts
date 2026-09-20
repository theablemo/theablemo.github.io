import { reducedMotion } from "./environment";

// One small disclosure, with no layout measurements or animation library.
const legend = document.querySelector<HTMLElement>("#timeline-legend");
const legendButton = legend?.querySelector<HTMLButtonElement>("button");
const legendLabels = document.querySelector<HTMLElement>("#legend-labels");
if (legend && legendButton && legendLabels) {
  let pinned = false;
  let preview = false;
  let hovering = false;
  let focused = false;
  let previewTimer: ReturnType<typeof setTimeout>;
  const update = () => {
    const expanded = pinned || preview || hovering || focused;
    legend.dataset.expanded = String(expanded);
    legendButton.setAttribute("aria-expanded", String(expanded));
    legendButton.setAttribute(
      "aria-label",
      (pinned ? legendButton.dataset.hideLabel : legendButton.dataset.showLabel) || `${pinned ? "Hide" : "Show"} timeline key: square for industry, diamond for academia`,
    );
    legendLabels.setAttribute("aria-hidden", String(!expanded));
  };
  legend.classList.add("enhanced");
  legendButton.hidden = false;
  update();
  legend.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") {
      hovering = true;
      update();
    }
  });
  legend.addEventListener("pointerleave", () => {
    hovering = false;
    update();
  });
  legendButton.addEventListener("focus", () => {
    focused = true;
    update();
  });
  legendButton.addEventListener("blur", () => {
    focused = false;
    update();
  });
  legendButton.addEventListener("click", () => {
    pinned = !pinned;
    focused = false;
    hovering = false;
    preview = false;
    update();
  });
  // The expanded labels extend beyond the compact button; keep their full
  // visible surface hoverable and let pointer activation use the same toggle.
  legendLabels.addEventListener("click", () => {
    legendButton.focus({ preventScroll: true });
    legendButton.click();
  });
  legendButton.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      pinned = false;
      focused = false;
      hovering = false;
      preview = false;
      update();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!legend.contains(e.target as Node)) {
      pinned = false;
      preview = false;
      focused = false;
      update();
    }
  });
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          preview = true;
          update();
          previewTimer = setTimeout(() => {
            preview = false;
            update();
          }, 2200);
          observer.disconnect();
        }
      },
      { threshold: 1 },
    );
    observer.observe(legend);
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) {
        observer.disconnect();
        clearTimeout(previewTimer);
        preview = false;
        update();
      }
    });
  }
}
