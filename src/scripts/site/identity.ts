import { root, reducedMotion } from "./environment";
import { roleGroup } from "./header-roles";

const portrait = document.querySelector<HTMLButtonElement>("#portrait");

// The same name and portrait move into the navigation; no duplicate identity.
const header = document.querySelector<HTMLElement>(".site-header");
const anchor = document.querySelector<HTMLElement>(".identity-anchor");
const lockup = document.querySelector<HTMLElement>(".identity-lockup");
const dock = document.querySelector<HTMLElement>(".identity-dock");
const firstName = lockup?.querySelector<HTMLElement>("h1");
const lastName = firstName?.querySelector<HTMLElement>("span");
const sections = [...document.querySelectorAll<HTMLElement>("main > .section")];
const navLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>(
    '.site-header nav a[href^="#"]',
  ),
];
let metrics:
  | {
      height: number;
      name: number;
      surname: number;
      photo: number;
      gap: number;
    }
  | undefined;
let frame = 0;
function setIdentityDocked(docked: boolean) {
  if (!anchor || !header || !roleGroup) return;
  header.dataset.identityDocked = String(docked);
  roleGroup.toggleAttribute("inert", !docked);
  roleGroup.setAttribute("aria-hidden", String(!docked));
}
function resetDock() {
  setIdentityDocked(false);
  metrics = undefined;
  lockup?.classList.remove("positioned");
  for (const el of [lockup, firstName, lastName, portrait, anchor])
    el?.removeAttribute("style");
}
function syncScroll() {
  frame = 0;
  const headerHeight = header?.offsetHeight || 76;
  root.style.setProperty("--header-height", `${headerHeight}px`);
  let active = "";
  for (const section of sections) {
    if (section.getBoundingClientRect().top < headerHeight + 150)
      active = section.id;
  }
  for (const link of navLinks) {
    if (link.hash === `#${active}`)
      link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  if (!anchor || !lockup || !dock || !portrait || !firstName || !lastName)
    return;
  const a = anchor.getBoundingClientRect(),
    d = dock.getBoundingClientRect();
  const newlyMeasured = !metrics;
  if (!metrics) {
    metrics = {
      height: lockup.offsetHeight,
      name: parseFloat(getComputedStyle(firstName).fontSize),
      surname: parseFloat(getComputedStyle(lastName).fontSize),
      photo: portrait.offsetWidth,
      gap: parseFloat(getComputedStyle(lockup).gap),
    };
    anchor.style.minHeight = `${metrics.height}px`;
  }
  const travel = Math.max(160, a.top + scrollY - headerHeight + metrics.height);
  // The companion uses the same original measurements for its portrait exit,
  // including when a page is first opened at a deep scroll position.
  portrait.dataset.homeSize = String(metrics.photo);
  portrait.dataset.homeHeight = String(metrics.height);
  portrait.dataset.dockTravel = String(travel);
  let progress = Math.min(1, Math.max(0, scrollY / travel));
  if (reducedMotion.matches) progress = progress > 0.7 ? 1 : 0;
  // Keep the space reserved, but expose the role only after the larger moving
  // identity has fully settled. Hide immediately when scrolling back upward.
  setIdentityDocked(progress === 1);
  const mix = (from: number, to: number) => from + (to - from) * progress;
  lockup.style.width = `${mix(a.width, d.width)}px`;
  lockup.style.gap = `${mix(metrics.gap, 10)}px`;
  firstName.style.fontSize = `${mix(metrics.name, 16)}px`;
  lastName.style.fontSize = `${mix(metrics.surname, 12)}px`;
  lastName.style.marginTop = `${mix(7, 2)}px`;
  portrait.style.width = `${mix(metrics.photo, 40)}px`;
  lockup.style.transform = `translate3d(${mix(a.left, d.left)}px, ${mix(a.top, d.top + (d.height - 40) / 2)}px, 0)`;
  lockup.classList.add("positioned");
  if (newlyMeasured) window.dispatchEvent(new Event("identity:measure"));
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(syncScroll);
}
window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", () => {
  resetDock();
  schedule();
});
reducedMotion.addEventListener("change", () => {
  resetDock();
  schedule();
});
document.fonts.ready.then(() => {
  resetDock();
  schedule();
});
if (header && "ResizeObserver" in window)
  new ResizeObserver(schedule).observe(header);
schedule();
