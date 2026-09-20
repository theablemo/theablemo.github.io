import { reducedMotion } from "./environment";

export const roleGroup = document.querySelector<HTMLElement>(".header-roles");

// Both roles share a grid cell so their crossfade never shifts the header.
// Hold the current link while it is hovered or focused; respect reduced motion.
const roleEntries = [...document.querySelectorAll<HTMLElement>(".header-role")];
if (roleGroup && roleEntries.length > 1) {
  let current = 0;
  let hovering = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const showRole = () => {
    roleEntries.forEach((entry, index) => {
      const active = index === current;
      entry.dataset.active = String(active);
      entry.setAttribute("aria-hidden", String(!active));
      entry.toggleAttribute("inert", !active);
      entry.hidden = false;
    });
  };
  const updateRotation = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (
      !reducedMotion.matches &&
      !document.hidden &&
      !hovering &&
      !roleGroup.contains(document.activeElement)
    ) {
      timer = setInterval(() => {
        current = (current + 1) % roleEntries.length;
        showRole();
      }, 6000);
    }
  };
  roleGroup.addEventListener("pointerenter", () => {
    hovering = true;
    updateRotation();
  });
  roleGroup.addEventListener("pointerleave", () => {
    hovering = false;
    updateRotation();
  });
  roleGroup.addEventListener("focusin", updateRotation);
  roleGroup.addEventListener("focusout", () =>
    requestAnimationFrame(updateRotation),
  );
  document.addEventListener("visibilitychange", updateRotation);
  reducedMotion.addEventListener("change", updateRotation);
  showRole();
  updateRotation();
}
