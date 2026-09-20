export {};

// Native anchors retain history and work without scripting; move keyboard focus too.
for (const link of document.querySelectorAll<HTMLAnchorElement>(
  'a[href^="#"]',
)) {
  link.addEventListener("click", () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target) {
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  });
}
