import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { build as bundle } from "esbuild";

const siteScript = (await bundle({
  entryPoints: ["src/scripts/site.ts"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
})).outputFiles[0].text;

const build = path.resolve("dist");
const htmlFiles = readdirSync(build, { recursive: true }).filter((f) =>
  f.endsWith(".html"),
);
const load = (file) =>
  new JSDOM(readFileSync(path.join(build, file), "utf8"), {
    url: `https://portfolio.test/${file === "index.html" ? "" : file.replace(/index\.html$/, "")}`,
  });

test("every generated local link, anchor, script and image resolves", () => {
  assert.ok(htmlFiles.length >= 4);
  for (const file of htmlFiles) {
    const dom = load(file);
    const ids = [...dom.window.document.querySelectorAll("[id]")].map(
      (n) => n.id,
    );
    assert.equal(new Set(ids).size, ids.length, `duplicate IDs in ${file}`);
    for (const node of dom.window.document.querySelectorAll("[href], [src]")) {
      const raw = node.getAttribute("href") || node.getAttribute("src");
      if (!raw || raw.startsWith("data:")) continue;
      const url = new URL(raw, dom.window.location.href);
      if (url.origin !== "https://portfolio.test") continue;
      const target = decodeURIComponent(url.pathname.slice(1));
      const destination = path.join(
        build,
        target.endsWith("/") || !target ? `${target}index.html` : target,
      );
      assert.ok(existsSync(destination), `${file}: missing ${raw}`);
      if (url.hash) {
        const targetDOM = new JSDOM(readFileSync(destination, "utf8"));
        assert.ok(
          targetDOM.window.document.getElementById(
            decodeURIComponent(url.hash.slice(1)),
          ),
          `${file}: missing anchor ${raw}`,
        );
        targetDOM.window.close();
      }
    }
    dom.window.close();
  }
});

test("homepage ships accessible content without JavaScript", () => {
  const dom = load("index.html");
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("h1").length, 1);
  for (const role of doc.querySelectorAll(".experience")) {
    assert.ok(role.querySelector("details summary"));
    assert.equal(role.querySelectorAll("summary a").length, 0);
  }
  for (const a of doc.querySelectorAll('a')) assert.ok(a.textContent.trim() || a.getAttribute('aria-label'));
  assert.equal(doc.querySelectorAll('img:not([alt])').length, 0);
  assert.equal(doc.querySelector('#theme-toggle').hidden, true);
  dom.window.close();
});

function interactive({ reduced = false, theme = "dark", docking = false, file = "index.html" } = {}) {
  const dom = new JSDOM(readFileSync(file === "index.html" ? "tests/fixtures/home.html" : "tests/fixtures/project.html", "utf8"), {
    url: "https://portfolio.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.document.documentElement.dataset.theme = theme;
  if (docking) {
    const doc = w.document;
    Object.defineProperty(doc.querySelector(".site-header"), "offsetHeight", { value: 76 });
    Object.defineProperty(doc.querySelector(".identity-lockup"), "offsetHeight", { value: 96 });
    Object.defineProperty(doc.querySelector("#portrait"), "offsetWidth", { value: 96 });
    doc.querySelector(".identity-anchor").getBoundingClientRect = () => ({ top: 134 - w.scrollY, left: 48, width: 350 });
    doc.querySelector(".identity-dock").getBoundingClientRect = () => ({ top: 16, left: 48, width: 150, height: 44 });
    w.getComputedStyle = element => ({ fontSize: element.tagName === "H1" ? "36px" : "24px", gap: "18px" });
  }
  w.matchMedia = () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  });
  w.document.fonts = { ready: Promise.resolve() };
  const frames = new Map();
  let frameID = 0;
  w.requestAnimationFrame = callback => {
    frames.set(++frameID, callback);
    return frameID;
  };
  w.cancelAnimationFrame = id => frames.delete(id);
  const flushFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(w.performance.now());
  };
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  const intervals = new Map();
  let intervalID = 0;
  w.setInterval = (callback) => {
    intervals.set(++intervalID, callback);
    return intervalID;
  };
  w.clearInterval = (id) => intervals.delete(id);
  const observed = [];
  w.IntersectionObserver = class {
    constructor(fn) {
      this.fn = fn;
      observed.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  };
  w.eval(siteScript);
  flushFrame();
  return { dom, w, doc: w.document, observed, intervals, flushFrame };
}

for (const reduced of [false, true]) {
  test(`header positions stay inaccessible until the identity docks, reduced motion ${reduced}`, () => {
    const { dom, w, doc, flushFrame } = interactive({ reduced, docking: true });
    const header = doc.querySelector(".site-header");
    const roles = doc.querySelector(".header-roles");
    for (const [scroll, visible] of [[0, false], [60, false], [110, false], [200, true], [80, false], [200, true]]) {
      w.scrollY = scroll;
      w.dispatchEvent(new w.Event("scroll"));
      flushFrame();
      assert.equal(header.dataset.identityDocked, String(visible));
      assert.equal(roles.hasAttribute("inert"), !visible);
      assert.equal(roles.getAttribute("aria-hidden"), String(!visible));
    }
    w.dispatchEvent(new w.Event("resize"));
    assert.equal(roles.hasAttribute("inert"), true);
    flushFrame();
    assert.equal(roles.hasAttribute("inert"), false);
    dom.window.close();
  });

  test(`interaction state and native navigation, reduced motion ${reduced}`, async () => {
    const { dom, w, doc, observed, intervals, flushFrame } = interactive({ reduced });
    const theme = doc.querySelector("#theme-toggle");
    assert.equal(doc.querySelector(".role-toggle"), null);
    const rotation = doc.querySelector(".header-roles");
    const roles = [...doc.querySelectorAll(".header-role")];
    assert.equal(intervals.size, reduced ? 0 : 1);
    if (!reduced) {
      [...intervals.values()][0]();
      assert.equal(roles[0].dataset.active, "false");
      assert.equal(roles[0].getAttribute("aria-hidden"), "true");
      assert.equal(roles[0].hasAttribute("inert"), true);
      assert.equal(roles[1].dataset.active, "true");
      assert.equal(roles[1].hasAttribute("inert"), false);
      [...intervals.values()][0]();
      assert.equal(roles[0].dataset.active, "true");
      assert.equal(roles[1].dataset.active, "false");
    }
    assert.ok(roles.every(role => !role.hidden), "both role boxes remain in the layout for a stable crossfade");
    rotation.dispatchEvent(new w.Event("pointerenter"));
    assert.equal(intervals.size, 0);
    rotation.dispatchEvent(new w.Event("pointerleave"));
    assert.equal(intervals.size, reduced ? 0 : 1);
    roles[0].focus();
    assert.equal(intervals.size, 0, "focused role links must not rotate away");
    roles[0].blur();
    flushFrame();
    assert.equal(intervals.size, reduced ? 0 : 1);
    assert.equal(theme.hidden, false);
    theme.click();
    assert.equal(doc.documentElement.dataset.theme, "light");
    assert.equal(w.localStorage.getItem("portfolio-theme"), "light");
    assert.equal(theme.getAttribute("aria-label"), "Switch to dark mode");
    theme.click();
    assert.equal(doc.documentElement.dataset.theme, "dark");
    const legend = doc.querySelector("#timeline-legend");
    const toggle = legend.querySelector("button");
    assert.equal(legend.dataset.expanded, "false");
    toggle.click();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(
      doc.querySelector("#legend-labels").getAttribute("aria-hidden"),
      "false",
    );
    doc.querySelector("#legend-labels").click();
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(doc.activeElement, toggle);
    doc.querySelector("#legend-labels").click();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    doc.activeElement.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    toggle.blur();
    toggle.focus();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    toggle.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    toggle.click();
    doc
      .querySelector(".intro-copy")
      .dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(observed.length, reduced ? 0 : 1);
    if (!reduced) {
      observed[0].fn([{ isIntersecting: true }]);
      assert.equal(legend.dataset.expanded, "true");
      assert.ok(observed[0].disconnected);
    }
    // Portrait interactions are owned by the home-only avatar controller;
    // its timers, gestures and preference behavior have their own tests.
    doc.querySelector('.site-header a[href="#experience"]').click();
    assert.equal(doc.activeElement.id, "experience");
    const summary = doc.querySelector(".experience summary");
    summary.click();
    assert.equal(summary.parentElement.open, true);
    summary.click();
    assert.equal(summary.parentElement.open, false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    dom.window.close();
  });
}

test("shared enhancements work on reading, archive, CV, and 404 pages", () => {
  for (const file of htmlFiles.filter(file => file !== "index.html")) {
    const { dom, w, doc, intervals, flushFrame } = interactive({ file });
    try {
      assert.equal(doc.querySelector("#portrait"), null);
      assert.equal(doc.querySelector("#timeline-legend"), null);
      assert.equal(doc.querySelector("#theme-toggle").hidden, false);
      doc.querySelector("#theme-toggle").click();
      assert.equal(doc.documentElement.dataset.theme, "light");
      doc.querySelector(".skip").click();
      assert.equal(doc.activeElement.id, "main");
      w.dispatchEvent(new w.Event("scroll"));
      w.dispatchEvent(new w.Event("resize"));
      flushFrame();
      assert.equal(doc.querySelector(".header-roles").hasAttribute("inert"), false);
      assert.equal(intervals.size, 1);
    } finally {
      dom.window.close();
    }
  }
});

test("published site excludes prototype bundles and keeps the script small", () => {
  const home = readFileSync(path.join(build, "index.html"), "utf8");
  assert.doesNotMatch(
    home,
    /exploration\.js|refinement\.js|review-bar|study-notes/,
  );
  const scripts = readdirSync(path.join(build, "_astro")).filter((f) =>
    f.endsWith(".js"),
  );
  const total = scripts.reduce(
    (sum, f) => sum + statSync(path.join(build, "_astro", f)).size,
    0,
  );
  // Includes editable accessibility labels, parachute metadata and controller, while keeping
  // every previous motion selectable without an animation dependency.
  assert.ok(total < 37_000, `unexpected client bundle growth: ${total} bytes`);
  assert.ok(!existsSync(path.join(build, "studies")));
  assert.ok(!existsSync(path.join(build, "archive")));
  assert.ok(!existsSync(path.join(build, "assets/avatar.png")));
  assert.ok(!existsSync(path.join(build, "assets/asset-sources.json")));
  assert.ok(!readdirSync(path.join(build, "assets"), { recursive: true }).some(f => f.endsWith(".prompt.txt")));

});
