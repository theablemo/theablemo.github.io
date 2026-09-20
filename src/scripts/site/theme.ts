import { root } from "./environment";

const themeButton = document.querySelector<HTMLButtonElement>("#theme-toggle");
function syncTheme() {
  const light = root.dataset.theme === "light";
  themeButton?.setAttribute(
    "aria-label",
    (light ? themeButton?.dataset.darkLabel : themeButton?.dataset.lightLabel) || `Switch to ${light ? "dark" : "light"} mode`,
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", light ? "#f2f7f7" : "#131e24");
}
if (themeButton) {
  themeButton.hidden = false;
  themeButton.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("portfolio-theme", root.dataset.theme);
    } catch {}
    syncTheme();
  });
}
syncTheme();
