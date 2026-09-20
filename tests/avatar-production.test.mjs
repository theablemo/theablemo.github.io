import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import sharp from "sharp";

const bundle = async (file) =>
  (
    await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "AvatarTest",
      platform: "browser",
    })
  ).outputFiles[0].text + ";globalThis.AvatarTest = AvatarTest;";
const [mainCode, coreCode, rendererCode, scrollCode] = await Promise.all(
  ["index", "core", "renderer", "scroll-motion"].map((name) =>
    bundle(`src/scripts/avatar/${name}.ts`),
  ),
);
const coreDOM = new JSDOM("", { runScripts: "outside-only" });
coreDOM.window.eval(coreCode);
const core = coreDOM.window.AvatarTest;
coreDOM.window.eval(scrollCode);
const { ScrollMotion } = coreDOM.window.AvatarTest;
const manifest = JSON.parse(readFileSync("src/data/avatar-clips.json"));
const settings = JSON.parse(readFileSync("src/data/avatar-settings.json"));

async function harness({
  reduced = false,
  saved = null,
  failImage = false,
  deferImage = false,
  initialScroll = 0,
  width = 1280,
  height = 800,
} = {}) {
  const dom = new JSDOM(readFileSync("tests/fixtures/home.html", "utf8"), {
    runScripts: "outside-only",
    url: "https://portfolio.test/",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    doc = w.document;
  let now = 0,
    nextId = 0,
    scroll = initialScroll,
    hidden = false;
  const timers = new Map(),
    frames = new Map(),
    observers = [],
    resized = [],
    requested = [],
    pendingImages = [];
  const media = {
    matches: reduced,
    addEventListener: (_, fn) => {
      media.change = fn;
    },
  };
  w.matchMedia = () => media;
  w.performance.now = () => now;
  w.requestAnimationFrame = (fn) => {
    frames.set(++nextId, fn);
    return nextId;
  };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  w.setTimeout = (fn, delay) => {
    timers.set(++nextId, { fn, at: now + delay });
    return nextId;
  };
  w.clearTimeout = (id) => timers.delete(id);
  w.IntersectionObserver = class {
    constructor(fn) {
      observers.push(fn);
    }
    observe() {}
  };
  w.ResizeObserver = class {
    constructor(fn) {
      resized.push(fn);
    }
    observe() {}
  };
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      clearRect() {},
      drawImage() {},
      putImageData() {},
      fillRect() {},
      fillText() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      getImageData: (_, __, width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      createImageData: (width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
    };
  };
  w.Image = class {
    set src(url) {
      requested.push(url);
      const resolve = () => (failImage ? this.onerror() : this.onload());
      if (deferImage) pendingImages.push(resolve);
      else Promise.resolve().then(resolve);
    }
  };
  Object.defineProperty(w, "scrollY", { get: () => scroll });
  Object.defineProperty(w, "innerWidth", { value: width });
  Object.defineProperty(w, "innerHeight", { value: height });
  Object.defineProperty(doc, "hidden", { get: () => hidden });
  const pad = width <= 380 ? 18 : width <= 700 ? 24 : 48,
    lane = width <= 700 ? 44 : 64;
  const body = width <= 700 ? 36 : 48;
  w.getComputedStyle = (el) => ({
    paddingLeft: (el.matches(".page") ? pad : lane) + "px",
    paddingRight:
      (el.matches(".page")
        ? pad
        : el.id === "experience"
          ? 0
          : width <= 700 ? 44 : 48) + "px",
    paddingTop: (width <= 700 ? 40 : 64) + "px",
    getPropertyValue: () => lane + "px",
  });
  const rect = (top, left, width, height) => ({
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  });
  let timelineHeight = 600;
  const mobile = width <= 700;
  const layout = () => {
    const work = timelineHeight + 860,
      publication = work + (mobile ? 1250 : 470),
      writing = publication + 660,
      contact = writing + 290;
    return {
      experience: [600, timelineHeight + 820],
      work: [work, publication - 60],
      publications: [publication, writing - 60],
      writing: [writing, contact - 60],
      contact: [contact, contact + 260],
    };
  };
  Object.defineProperty(doc.documentElement, "scrollHeight", {
    get: () => layout().contact[1],
  });
  doc.querySelector(".page").getBoundingClientRect = () =>
    rect(-scroll, 0, width, layout().contact[1]);
  doc.querySelector(".site-header").getBoundingClientRect = () =>
    rect(0, 0, width, 76);
  doc.querySelector(".identity-anchor").getBoundingClientRect = () =>
    rect(134 - scroll, pad, 320, 96);
  doc.querySelector("#portrait").getBoundingClientRect = () =>
    rect(
      Math.max(12, 134 - scroll),
      pad,
      scroll > 300 ? 40 : 96,
      scroll > 300 ? 40 : 96,
    );
  doc.querySelector(".timeline").getBoundingClientRect = () =>
    rect(
      760 - scroll,
      pad + lane + 4,
      width - 2 * pad - 2 * lane,
      timelineHeight,
    );
  Object.defineProperty(doc.querySelector(".timeline"), "offsetHeight", {
    get: () => timelineHeight,
  });
  for (const id of Object.keys(layout())) {
    const el = doc.getElementById(id);
    el.getBoundingClientRect = () => {
      const [top, bottom] = layout()[id];
      return rect(top - scroll, pad, width - 2 * pad, bottom - top);
    };
    const heading = el.querySelector(".section-heading");
    if (heading) {
      const left = pad + lane,
        right = width - pad - (id === "experience" ? 0 : mobile ? 44 : 48);
      heading.getBoundingClientRect = () =>
        rect(
          layout()[id][0] + (mobile ? 40 : 64) - scroll,
          left,
          right - left,
          mobile ? 62 : 67,
        );
      [...heading.children].forEach((child, i) => {
        child.getBoundingClientRect = () => {
          const h = heading.getBoundingClientRect();
          return rect(
            h.top + 16,
            i === 0 ? left : right - 114,
            i === 0 ? Math.min(235, right - left) : 114,
            34,
          );
        };
      });
    }
  }
  const arts = [...doc.querySelectorAll(".project-art")];
  arts.forEach((el, i) => {
    el.getBoundingClientRect = () => {
      const full = width - 2 * pad - 2 * lane,
        cardWidth = mobile ? full : (full - 56) / 3;
      return rect(
        layout().work[0] + 75 + body + 24 + (mobile ? i * 360 : 0) - scroll,
        pad + lane + (mobile ? 0 : i * (cardWidth + 28)),
        cardWidth,
        cardWidth / 1.85,
      );
    };
  });
  if (saved) w.localStorage.setItem("portfolio-avatar-motion", saved);
  w.eval(mainCode);
  const flush = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve();
  };
  async function step(ms = 16) {
    now += ms;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(now));
    for (const [id, timer] of [...timers])
      if (timer.at <= now) {
        timers.delete(id);
        timer.fn();
      }
    await flush();
  }
  await step();
  const portrait = doc.querySelector("#portrait"),
    journey = doc.querySelector("#avatar-journey"),
    toggle = doc.querySelector("#avatar-motion");
  return {
    dom,
    w,
    doc,
    portrait,
    journey,
    toggle,
    frames,
    timers,
    requested,
    step,
    flush,
    maxScroll: () => doc.documentElement.scrollHeight - height,
    find: async (scene, zone) => {
      for (
        let y = 10;
        y <= doc.documentElement.scrollHeight - height;
        y += 10
      ) {
        scroll = y;
        w.dispatchEvent(new w.Event("scroll"));
        await step();
        if (!journey.hidden && journey.dataset.scene === scene && journey.dataset.zone === zone)
          return y;
      }
      throw Error("Scene not found: " + scene + " " + zone);
    },
    pointer: (type, pointerType = "mouse") => {
      const event = new w.Event(type);
      Object.defineProperty(event, "pointerType", { value: pointerType });
      portrait.dispatchEvent(event);
    },
    scroll: async (y) => {
      scroll = y;
      w.dispatchEvent(new w.Event("scroll"));
      await step();
    },
    wheel: async (y, { deltaY = 120, deltaMode = 0, ctrlKey = false } = {}) => {
      const event = new w.WheelEvent("wheel", { deltaY, deltaMode, ctrlKey, cancelable: true });
      w.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, "native scrolling is never intercepted");
      scroll = y;
      w.dispatchEvent(new w.Event("scroll"));
      await step();
    },
    visibility: async (state) => {
      hidden = state;
      doc.dispatchEvent(new w.Event("visibilitychange"));
      await step();
    },
    reduced: async (state) => {
      media.matches = state;
      media.change();
      await step();
    },
    intersection: async (state) => {
      observers[0]([{ isIntersecting: state }]);
      await step();
    },
    expandTimeline: async (amount) => {
      timelineHeight += amount;
      doc.querySelector("details").dispatchEvent(new w.Event("toggle"));
      await step();
    },
    resolveImages: async () => {
      pendingImages.splice(0).forEach((resolve) => resolve());
      await flush();
    },
  };
}

test("production preserves Current; all frame crops, masks and anchors fit their assets", async () => {
  const hash = createHash("sha256")
    .update(readFileSync("public/assets/avatar/current.png"))
    .digest("hex");
  assert.equal(
    hash,
    "24b9c6cbd79eedddf5365b9fa666bc1280df7dcf09e06bf62bcc1093a6b79b63",
  );
  assert.equal(settings.activeOutfit, "minimal-white-black");
  assert.equal(settings.outfits[settings.activeOutfit].shirtColor, "#ffffff");
  assert.equal(settings.outfits[settings.activeOutfit].markText, "");
  let bytes = 0;
  const files = new Set();
  for (const [name, clip] of Object.entries(manifest.clips)) {
    const file = `public${clip.file}`;
    if (!files.has(file)) bytes += statSync(file).size;
    files.add(file);
    const { width, height, hasAlpha } = await sharp(file).metadata();
    assert.equal(hasAlpha, true);
    for (const frame of clip.frames) {
      const [x, y, w, h] = frame.source;
      assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height, name);
      assert.ok(frame.pivot.every(Number.isFinite));
      const [mx, my, mw, mh] = frame.shirt;
      assert.ok(
        mx >= 0 && my >= 0 && mx + mw <= w && my + mh <= h,
        `${name}: garment mask`,
      );
      assert.ok(my + mh < frame.bounds[3] - 50, `${name}: shoes excluded`);
      if (frame.portrait) {
        const [px, py, pw, ph] = frame.portrait;
        assert.ok(
          px >= 0 && py >= 0 && px + pw <= w && py + ph <= h,
          `${name}: portrait crop`,
        );
      }
      if (frame.airborne) assert.ok(frame.pivot[1] > frame.bounds[3] + 60);
    }
  }
  assert.ok(bytes < 8_100_000, `${bytes} bytes including the additional 650 KB expression sheet, loaded on demand`);
});

test("frame boundaries, gait hysteresis and garment selection remain stable", () => {
  for (let i = 0; i < 6; i++)
    assert.equal(core.frameAt(i / 6, [0, 1, 2, 3, 4, 5]), i);
  assert.equal(core.gait("walk", 240), "run");
  assert.equal(core.gait("run", 150), "run");
  assert.equal(core.gait("run", 100), "walk");
  assert.equal(core.shirtPixel(240, 241, 242, 255), true);
  assert.equal(core.shirtPixel(206, 135, 91, 255), false);
  assert.equal(core.shirtPixel(25, 25, 25, 255), false);
});

test("portrait waves first, cycles on hover, exits immediately, and supports tap and Escape", async () => {
  const h = await harness();
  assert.equal(h.requested.length, 0, "no artwork loaded before use");
  h.pointer("pointerenter");
  await h.flush();
  assert.equal(h.portrait.dataset.avatar, "true");
  assert.equal(h.portrait.dataset.gesture, "wave");
  assert.deepEqual(h.requested, ["/assets/avatar/wave.png"]);
  for (let i = 0; i < 5; i++) await h.step(2300);
  assert.equal(h.portrait.dataset.avatar, "true");
  assert.ok(h.requested.length <= 3, "shared gesture sheets are decoded once");
  h.pointer("pointerleave");
  assert.equal(h.portrait.dataset.avatar, "false", "exit cancels the gesture immediately");
  await h.step(2300);
  assert.equal(h.portrait.dataset.avatar, "false");
  h.pointer("pointerenter", "touch");
  await h.flush();
  assert.equal(
    h.portrait.dataset.avatar,
    "false",
    "touch hover is not simulated",
  );
  h.portrait.click();
  await h.flush();
  assert.equal(h.portrait.getAttribute("aria-pressed"), "true");
  assert.equal(h.portrait.dataset.avatar, "true");
  assert.equal(h.portrait.dataset.gesture, "wave");
  h.portrait.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(h.portrait.dataset.avatar, "false");
  assert.equal(h.portrait.getAttribute("aria-pressed"), "false");
  h.dom.window.close();
});

test("automatic cameos finish; visibility and offscreen pauses do not build a backlog", async () => {
  const h = await harness();
  await h.step(46000);
  assert.equal(h.portrait.dataset.avatar, "true");
  assert.equal(h.portrait.dataset.gesture, "wave");
  await h.step(2300);
  assert.equal(h.portrait.dataset.avatar, "true");
  assert.notEqual(h.portrait.dataset.gesture, "wave", "cameo has a second, random expression");
  await h.step(2300);
  assert.equal(h.portrait.dataset.avatar, "false");
  await h.visibility(true);
  await h.step(100000);
  assert.equal(h.timers.size, 0);
  assert.equal(h.portrait.dataset.avatar, "false");
  await h.visibility(false);
  assert.equal(h.portrait.dataset.avatar, "false");
  await h.intersection(false);
  await h.step(100000);
  assert.equal(h.portrait.dataset.avatar, "false");
  await h.intersection(true);
  await h.step(46000);
  assert.equal(h.portrait.dataset.avatar, "true");
  h.dom.window.close();
});

test("journey uses horizontal ground, supported descents, reverse climbing and rests", async () => {
  const h = await harness();
  const ropeAt = await h.find("experience", "abseil");
  await h.scroll(ropeAt + 20);
  assert.equal(h.journey.dataset.action, "abseil");
  await h.scroll(ropeAt + 10);
  assert.equal(h.journey.dataset.action, "climb");
  assert.equal(h.journey.dataset.direction, "up");
  const walkAt = await h.find("work", "walk");
  const x = Number(h.journey.dataset.x),
    y = Number(h.journey.dataset.y);
  await h.scroll(walkAt + 1);
  assert.notEqual(
    Number(h.journey.dataset.x),
    x,
    "walking changes horizontal position",
  );
  assert.equal(
    Number(h.journey.dataset.y),
    y,
    "walking has constant document-ground height",
  );
  assert.match(h.journey.dataset.action, /walk|run/);
  await h.step(200);
  await h.step();
  await h.step();
  await h.step();
  assert.equal(h.journey.dataset.action, "idle");
  assert.equal(h.frames.size, 0, "resting avatar does not loop");
  await h.find("publications", "elevator");
  assert.equal(h.journey.dataset.action, "expressions");
  assert.notEqual(
    h.journey.querySelector(".avatar-platform").style.display,
    "none",
  );
  await h.find("contact", "rest");
  assert.equal(h.journey.dataset.action, "wave");
  await h.scroll(0);
  assert.equal(h.journey.hidden, true);
  h.dom.window.close();
});

test("Experience restores its original lane, body size, scroll tracking and rope anchor", async () => {
  for (const width of [320, 390, 1280]) {
    const h = await harness({ width });
    await h.scroll(550);
    const pad = width <= 380 ? 18 : width <= 700 ? 24 : 48;
    const lane = width <= 700 ? 44 : 64;
    const x = pad + lane / 2;
    assert.equal(h.journey.dataset.zone, "abseil");
    assert.equal(Number(h.journey.dataset.x), x);
    assert.equal(Number(h.journey.dataset.y) - 550, 480);
    assert.equal(
      parseFloat(h.journey.querySelector("canvas").style.width),
      (128 * (width <= 700 ? 56 : 80)) / 96,
    );
    assert.equal(h.journey.style.zIndex, "18");
    const rope = h.journey.querySelector(".avatar-rope");
    const points = rope
      .getAttribute("d")
      .match(/-?\d+(?:\.\d+)?/g)
      .map(Number);
    assert.deepEqual(
      points.slice(0, 4),
      [pad + lane + 8, 245, x, 245],
      "original tie point and horizontal elbow",
    );
    assert.deepEqual(
      points.slice(-2),
      [x, 775],
      "original lower rope endpoint",
    );
    const anchor = h.journey.querySelector(".avatar-rope-anchor");
    assert.equal(Number(anchor.getAttribute("cx")), x);
    assert.equal(Number(anchor.getAttribute("cy")), 245);
    await h.scroll(450);
    assert.equal(h.journey.dataset.action, "climb");
    assert.equal(Number(h.journey.dataset.y) - 450, 480);
    await h.scroll(80);
    assert.equal(h.journey.dataset.scene, "portrait", "entry starts at the portrait");
    h.dom.window.close();
  }
});

test("wall crawling has alternating contacts and no web, rope or rotation", async () => {
  const h = await harness();
  assert.equal(
    h.doc.querySelectorAll(
      ".avatar-stage, .avatar-world, .avatar-support-ladder, .avatar-support-rail",
    ).length,
    0,
  );
  let y = await h.find("work", "crawl");
  while (Number(h.journey.dataset.progress) < 0.25) await h.scroll(++y);
  assert.equal(h.journey.dataset.action, "crawl");
  assert.doesNotMatch(h.journey.querySelector("canvas").style.transform, /rotate/);
  assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
  const pose = h.journey.dataset.frame;
  await h.scroll(y + 35);
  assert.notEqual(h.journey.dataset.frame, pose, "limbs change with vertical travel");
  await h.scroll(y);
  assert.equal(h.journey.dataset.frame, pose, "reverse scroll returns to the same contacts");
  assert.equal(
    h.journey.querySelector(".avatar-rope-anchor").style.display,
    "none",
  );
  assert.equal(
    h.journey.querySelector(".avatar-platform").style.display,
    "none",
  );
  await h.find("publications", "elevator");
  assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
  assert.equal(h.journey.querySelector(".avatar-platform").style.display, "");
  await h.find("contact", "rest");
  assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
  assert.equal(
    h.journey.querySelector(".avatar-platform").style.display,
    "none",
  );
  h.dom.window.close();
});

test("a paused hop lands, stays landed on resume, and can reverse without snapping", async () => {
  const h = await harness();
  const at = await h.find("work", "hop");
  await h.scroll(at + 1);
  for (let i = 0; i < 40; i++) await h.step();
  assert.equal(h.journey.dataset.progress, "1.000");
  assert.equal(h.journey.dataset.action, "idle");
  const x = Number(h.journey.dataset.x);
  await h.scroll(at + 2);
  assert.equal(
    Number(h.journey.dataset.x),
    x,
    "resume retains the reached landing",
  );
  await h.scroll(at + 1);
  assert.equal(
    Number(h.journey.dataset.x),
    x,
    "reversal starts at the current position",
  );
  await h.step(250);
  await h.step();
  assert.equal(h.journey.dataset.progress, "0.000");
  h.dom.window.close();
});

test("deep links, expanded timelines and mobile dimensions use current measured geometry", async () => {
  for (const width of [320, 390, 768, 1440]) {
    const h = await harness({ initialScroll: 900, width });
    assert.equal(h.journey.hidden, false);
    const initial = Number(h.journey.dataset.y);
    await h.expandTimeline(600);
    assert.ok(Number.isFinite(Number(h.journey.dataset.y)));
    assert.notEqual(
      Number(h.journey.dataset.y),
      initial,
      "disclosure updates the route",
    );
    const canvas = h.journey.querySelector("canvas");
    assert.equal(
      parseFloat(canvas.style.width),
      (128 * (width <= 700 ? 56 : 80)) / 96,
    );
    await h.find("work", "hop");
    assert.ok(
      Number(h.journey.dataset.x) >= 0 && Number(h.journey.dataset.x) <= width,
    );
    h.dom.window.close();
  }
});

test("reduced motion and the saved pause preference prevent unsolicited motion", async () => {
  for (const options of [{ reduced: true }, { saved: "off" }]) {
    const h = await harness(options);
    h.pointer("pointerenter");
    await h.step(100000);
    await h.scroll(900);
    assert.equal(h.journey.hidden, true);
    assert.equal(h.portrait.dataset.avatar, "false");
    assert.equal(h.requested.length, 0);
    h.portrait.click();
    await h.flush();
    assert.equal(
      h.portrait.dataset.avatar,
      "true",
      "explicit activation can inspect a still",
    );
    assert.deepEqual(h.requested, ["/assets/avatar/current.png"]);
    assert.equal(h.timers.size, 0);
    assert.equal(h.frames.size, 0);
    h.dom.window.close();
  }
  const h = await harness();
  await h.scroll(550);
  h.toggle.click();
  await h.step();
  assert.equal(h.journey.hidden, true);
  assert.equal(h.w.localStorage.getItem("portfolio-avatar-motion"), "off");
  h.toggle.click();
  await h.step();
  assert.equal(h.journey.hidden, false);
  await h.reduced(true);
  assert.equal(h.journey.hidden, true);
  assert.equal(h.toggle.textContent, "Avatar motion: reduced");
  h.dom.window.close();
});

test("asset failure keeps the photograph and content usable", async () => {
  const h = await harness({ failImage: true });
  h.portrait.click();
  await h.flush();
  assert.equal(h.portrait.dataset.avatar, "false");
  await h.scroll(550);
  assert.equal(h.journey.hidden, true);
  assert.equal(
    h.doc.querySelector(".photograph").getAttribute("alt"),
    "Mohammad Abolnejadian",
  );
  assert.equal(h.doc.querySelectorAll(".project a.project-art").length, 3);
  h.dom.window.close();
});

test("keyboard focus previews gestures; late image loads cannot undo Escape or a motion pause", async () => {
  const h = await harness({ deferImage: true });
  h.portrait.focus();
  assert.ok(h.requested.length > 0, "keyboard focus starts the preview");
  h.portrait.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape" }));
  await h.scroll(550);
  h.toggle.click();
  await h.step();
  await h.resolveImages();
  assert.equal(h.portrait.dataset.avatar, "false");
  assert.equal(h.journey.hidden, true);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  h.dom.window.close();
});

test("wardrobe rejects unknown outfits and shares cached layers between both instances", async () => {
  const h = await harness();
  h.w.eval(rendererCode);
  const { AvatarRenderer, outfits } = h.w.AvatarTest;
  const renderer = new AvatarRenderer();
  assert.equal(renderer.setOutfit("missing"), false);
  const initial = await renderer.pose("idle");
  assert.strictEqual(await renderer.pose("idle"), initial);
  outfits.test = {
    shirtColor: "#5c8a8f",
    markText: "TEAM",
    markColor: "#111111",
  };
  assert.equal(renderer.setOutfit("test"), true);
  const changed = await renderer.pose("idle");
  assert.notStrictEqual(changed, initial);
  assert.deepEqual(
    h.requested,
    ["/assets/avatar/current.png"],
    "outfit changes do not fetch or regenerate character images",
  );
  await renderer.pose("idle", 0, true);
  assert.equal(
    h.requested.length,
    1,
    "portrait and body share the decoded image",
  );
  h.dom.window.close();
});

test("portrait hands off its own face before four sequential foot poses, then restores on return", async () => {
  const h = await harness();
  h.portrait.click();
  await h.flush();
  const seen = new Set();
  let sawHandoff = false, sawPullback = false;
  for (let y = 20; y <= 125; y += 3) {
    await h.scroll(y);
    if (h.journey.dataset.zone === "step-out") {
      if (h.journey.dataset.action === "step-out") seen.add(h.journey.dataset.frame);
      else { assert.equal(h.journey.dataset.action, "idle"); sawPullback = true; }
      sawHandoff ||= !h.journey.querySelector(".avatar-handoff").hidden;
      assert.equal(h.portrait.dataset.journeyExit, "true");
      assert.equal(h.journey.style.clipPath, "url(#avatar-exit-mask)");
      assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
    }
  }
  assert.ok(sawHandoff && sawPullback, "the current portrait is captured, then the same master pulls back");
  assert.deepEqual([...seen], ["0", "1", "2", "3"]);
  const flightStart = await h.find("portrait", "parachute");
  await h.scroll(flightStart + 30);
  assert.equal(h.journey.dataset.action, "parachute");
  await h.find("work", "crawl");
  assert.equal(h.requested.filter(url => url === "/assets/avatar/traversal.png").length, 1);
  await h.find("writing", "slide");
  assert.equal(h.requested.filter(url => url === "/assets/avatar/front-traversal.png").length, 1);
  await h.scroll(200);
  assert.equal(h.journey.dataset.action, "parachute", "retrace the flight toward the portrait");
  await h.scroll(0);
  assert.equal(h.journey.hidden, true);
  assert.equal(h.portrait.dataset.journeyExit, "false");
  h.dom.window.close();
});

test("the rendered companion remains inside both screen edges throughout narrow routes", async () => {
  for (const width of [320, 360, 390, 768]) {
    const h = await harness({ width });
    let sawRightCrawl = false;
    for (let y = 25; y <= h.maxScroll(); y += 17) {
      await h.scroll(y);
      if (h.journey.hidden) continue;
      if (h.journey.dataset.zone === "step-out") {
        const mask = h.journey.querySelector(".avatar-exit-circle");
        const center = Number(mask.getAttribute("cx")), radius = Number(mask.getAttribute("r"));
        assert.ok(center - radius >= 0 && center + radius <= width, "portrait zoom stays inside its on-screen circular mask");
        continue;
      }
      const x = Number(h.journey.dataset.x), half = parseFloat(h.journey.querySelector("canvas").style.width) / 2;
      assert.ok(x - half >= -0.01 && x + half <= width + 0.01, `${width}px: full canvas visible at scroll ${y}`);
      if (h.journey.dataset.zone === "crawl" && x > width / 2) sawRightCrawl = true;
    }
    assert.equal(sawRightCrawl, true, `${width}px: far-side crawling was exercised`);
    h.dom.window.close();
  }
});

test("parachute deploys only during flight and retraces its drift and cords on reverse scroll", async () => {
  for (const width of [320, 390, 768, 1280]) {
    const h = await harness({ width });
    const start = await h.find("portrait", "parachute");
    const positions = [];
    const chute = h.journey.querySelector(".avatar-parachute");
    for (let y = start + 30; y < 1000; y += 13) {
      await h.scroll(y);
      if (h.journey.dataset.scene !== "portrait") break;
      const cords = chute.querySelector("path").getAttribute("d");
      assert.doesNotMatch(cords, /NaN|Infinity/);
      assert.equal(chute.style.display, "");
      assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
      assert.equal(h.journey.querySelector(".avatar-platform").style.display, "none");
      const opacity = Number(chute.style.opacity);
      assert.ok(opacity >= 0 && opacity <= 1);
      // The canopy is wider than the body and must also fit on a narrow phone.
      const open = Number(chute.querySelector(".avatar-parachute-sail").getAttribute("transform").match(/scale\(([^)]+)/)[1]);
      const scale = parseFloat(h.journey.querySelector("canvas").style.width) / 128;
      const x = Number(h.journey.dataset.x), half = 108 * open * scale;
      assert.ok(x - half >= 0 && x + half <= width);
      positions.push({ y, x: h.journey.dataset.x, docY: h.journey.dataset.y, cords });
    }
    for (const p of positions.reverse()) {
      await h.scroll(p.y);
      assert.equal(h.journey.dataset.action, "parachute");
      assert.equal(h.journey.dataset.x, p.x);
      assert.equal(h.journey.dataset.y, p.docY);
      assert.equal(chute.querySelector("path").getAttribute("d"), p.cords);
    }
    assert.equal(h.requested.filter(url => url === "/assets/avatar/parachute.png").length, 1);
    await h.find("experience", "abseil");
    assert.equal(chute.style.display, "none");
    await h.scroll(start + 50);
    await h.reduced(true);
    assert.equal(h.journey.hidden, true);
    assert.equal(h.portrait.dataset.journeyExit, "false");
    h.dom.window.close();
  }
});

test("Notes slides down with the retained atlas and climbs on return without props", async () => {
  const h = await harness();
  let y = await h.find("writing", "slide");
  while (Number(h.journey.dataset.progress) < 0.25) await h.scroll(++y);
  assert.equal(h.journey.dataset.action, "slide");
  for (const selector of [".avatar-rope", ".avatar-platform", ".avatar-parachute"])
    assert.equal(h.journey.querySelector(selector).style.display, "none");
  await h.scroll(y + 5);
  await h.scroll(y);
  assert.equal(h.journey.dataset.action, "crawl");
  assert.equal(h.journey.dataset.direction, "up");
  h.dom.window.close();
});

test("front-facing crawl can be restored through the existing section override", async () => {
  const h = await harness();
  h.doc.getElementById("writing").dataset.avatarDescent = "crawl-front";
  await h.flush();
  await h.step();
  let y = await h.find("writing", "crawl-front");
  while (Number(h.journey.dataset.progress) < 0.25) await h.scroll(++y);
  const frame = h.journey.dataset.frame;
  const contacts = new Set([frame]);
  for (let i = 1; i <= 6; i++) {
    await h.scroll(y + i);
    assert.equal(h.journey.dataset.action, "crawl-front");
    contacts.add(h.journey.dataset.frame);
  }
  assert.ok(contacts.size > 1);
  await h.scroll(y);
  assert.equal(h.journey.dataset.frame, frame);
  assert.equal(h.journey.querySelector(".avatar-rope").style.display, "none");
  h.dom.window.close();
});

test("every added expression has a distinct pose and returns to neutral", () => {
  const poses = new Set();
  for (const gesture of ['laugh', 'surprised', 'thoughtful', 'sleepy']) {
    const pose = core.gestureAt(gesture, 600);
    assert.equal(pose.clip, 'expressions-extra');
    assert.ok(manifest.clips[pose.clip].frames[pose.frame].portrait);
    poses.add(pose.frame);
    assert.equal(core.gestureAt(gesture, 0).clip, 'expressions');
    assert.equal(core.gestureAt(gesture, core.gestureLength(gesture) - 1).frame, 0);
  }
  assert.equal(poses.size, 4);
});

test("taps play exactly a wave and one expression, then restore the photograph and label", async () => {
  const h = await harness({ width: 390 });
  h.portrait.click();
  await h.flush();
  assert.equal(h.portrait.dataset.gesture, 'wave');
  await h.step(2150);
  const expression = h.portrait.dataset.gesture;
  assert.notEqual(expression, 'wave');
  await h.step(2300);
  assert.equal(h.portrait.dataset.avatar, 'false');
  assert.equal(h.portrait.getAttribute('aria-pressed'), 'false');
  assert.match(h.portrait.getAttribute('aria-label'), /Meet/);
  h.portrait.click();
  await h.flush();
  assert.equal(h.portrait.dataset.gesture, 'wave');
  await h.step(2150);
  assert.notEqual(h.portrait.dataset.gesture, expression, 'successive appearances avoid repeating expressions');
  h.portrait.click();
  assert.equal(h.portrait.dataset.avatar, 'false');
  h.dom.window.close();
});

test("hover interrupts a cameo with a fresh wave, and leaving cancels a clicked preview", async () => {
  const h = await harness();
  await h.step(46000);
  await h.step(2150);
  assert.notEqual(h.portrait.dataset.gesture, 'wave');
  h.pointer('pointerenter');
  await h.flush();
  assert.equal(h.portrait.dataset.gesture, 'wave');
  await h.step(700);
  h.pointer('pointerleave');
  assert.equal(h.portrait.dataset.avatar, 'false');
  h.pointer('pointerenter');
  await h.flush();
  assert.equal(h.portrait.dataset.gesture, 'wave');
  h.portrait.click();
  await h.flush();
  h.pointer('pointerleave');
  assert.equal(h.portrait.dataset.avatar, 'false');
  await h.step(5000);
  assert.equal(h.portrait.dataset.avatar, 'false', 'cancelled timers cannot reopen the preview');
  h.dom.window.close();
});

test("a slow first image gets a full wave; late images cannot reopen a pointer exit", async () => {
  const h = await harness({ deferImage: true });
  h.pointer('pointerenter');
  await h.step(5000);
  await h.resolveImages();
  assert.equal(h.portrait.dataset.gesture, 'wave');
  await h.step(1000);
  assert.equal(h.portrait.dataset.gesture, 'wave');
  h.pointer('pointerleave');
  await h.step(1500);
  assert.equal(h.portrait.dataset.avatar, 'false');
  h.dom.window.close();
  const late = await harness({ deferImage: true });
  late.pointer('pointerenter');
  late.pointer('pointerleave');
  await late.resolveImages();
  assert.equal(late.portrait.dataset.avatar, 'false');
  assert.equal(late.timers.size, 1, 'only the next scheduled cameo remains');
  late.dom.window.close();
});

test("wheel easing is bounded, frame-rate independent, and never coasts through reversal", () => {
  const at = (interval) => {
    const motion = new ScrollMotion(400);
    motion.wheel({ deltaX: 0, deltaY: 120, deltaMode: 0 }, 0);
    motion.follow(520, 0, 520);
    let previous = 400;
    for (let t = interval; t <= 96; t += interval) {
      const value = motion.follow(520, t, 520);
      assert.ok(value >= previous && value <= 520);
      previous = value;
    }
    return motion;
  };
  const a = at(16), b = at(8);
  assert.ok(Math.abs(a.value - b.value) < 1e-8);
  assert.ok(a.value > 400 && a.value < 520);
  assert.equal(a.follow(520, 150, 520), 520);
  assert.equal(a.pending, false);
  b.wheel({ deltaX: 0, deltaY: -120, deltaMode: 0 }, 97);
  assert.equal(b.follow(400, 98, 520), 400);
  assert.equal(b.pending, false);
  const fine = new ScrollMotion(400);
  fine.wheel({ deltaX: 0, deltaY: 3, deltaMode: 0 }, 0);
  assert.equal(fine.follow(403, 16, 520), 403);
  fine.wheel({ deltaX: 0, deltaY: 120, deltaMode: 0 }, 20);
  assert.equal(fine.follow(1900, 32, 520), 1900, 'large navigation jumps are direct');
});

test("wheel notches advance intermediate limb poses while the Experience rope stays attached", async () => {
  for (const width of [390, 1280]) {
    const h = await harness({ width });
    await h.scroll(400);
    await h.wheel(520);
    const values = [], poses = new Set();
    for (let i = 0; i < 11; i++) {
      await h.step();
      values.push(Number(h.journey.dataset.scroll));
      poses.add(h.journey.dataset.frame);
      assert.equal(Number(h.journey.dataset.y) - 520, 480, 'body retains original viewport tracking');
      assert.equal(Number(h.journey.querySelector('.avatar-rope-anchor').getAttribute('cy')), 275);
      assert.doesNotMatch(h.journey.querySelector('.avatar-rope').getAttribute('d'), /NaN|Infinity/);
    }
    assert.ok(values[0] > 400 && values[0] < 520);
    assert.equal(values.at(-1), 520);
    assert.ok(poses.size >= 3, 'wheel notch is spread across multiple limb poses');
    await h.step(200);
    await h.step();
    assert.equal(h.frames.size, 0, 'smoothing does not create an idle render loop');
    await h.wheel(500, { deltaY: -120 });
    assert.equal(h.journey.dataset.direction, 'up');
    assert.equal(h.journey.dataset.action, 'climb');
    await h.wheel(0, { deltaY: -120 });
    assert.equal(h.journey.hidden, true);
    assert.notEqual(h.portrait.dataset.journeyExit, 'true');
    h.dom.window.close();
  }
});

test("wheel motion preserves heading alignment, portrait clipping, and cancels for reduced motion", async () => {
  for (const width of [320, 1280]) {
    const h = await harness({ width });
    // Narrow headings can be one continuous obstacle jump with no walk span.
    if (width > 700) {
      const at = await h.find('work', 'walk');
      const ground = Number(h.journey.dataset.y);
      await h.wheel(at + 1, { deltaY: 1, deltaMode: 1 });
      for (let i = 0; i < 11; i++) {
        await h.step();
        assert.equal(Number(h.journey.dataset.y), ground);
      }
    }
    await h.scroll(0);
    await h.wheel(80);
    for (let i = 0; i < 11; i++) {
      await h.step();
      assert.doesNotMatch(h.journey.querySelector('canvas').style.transform, /NaN|Infinity/);
    }
    assert.equal(h.journey.dataset.scene, 'portrait');
    assert.equal(Number(h.journey.dataset.scroll), 80);
    await h.wheel(200);
    await h.reduced(true);
    assert.equal(h.journey.hidden, true);
    assert.equal(h.frames.size, 0);
    assert.equal(h.portrait.dataset.journeyExit, 'false');
    h.dom.window.close();
  }
});

test("sustained wheel bursts keep moving while new targets arrive every frame", () => {
  const motion = new ScrollMotion(400);
  let previous = 400;
  for (let i = 0; i < 12; i++) {
    const now = i * 16, target = 520 + i * 80;
    motion.wheel({ deltaX: 0, deltaY: 80, deltaMode: 0 }, now);
    const value = motion.follow(target, now, 520);
    if (i > 0) assert.ok(value > previous, 'new targets must not freeze pending motion');
    assert.ok(value < target, 'intermediate position stays short of the native target');
    previous = value;
  }
  assert.equal(motion.follow(1400, 400, 520), 1400);
  assert.equal(motion.pending, false);
});
