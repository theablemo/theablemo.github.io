import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
const output = await build({
  entryPoints: ["src/scripts/avatar/route.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const {
  buildRoute,
  sampleRoute,
  pointAt,
  originalExperienceAt,
  recipe,
  descent,
  portraitAt,
  exitFrame,
  safeLanes,
} = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);
const clips = JSON.parse(readFileSync("src/data/avatar-clips.json")).clips;
const spriteRadius = Math.max(
  ...["walk", "run"].flatMap((name) =>
    clips[name].frames.flatMap((f) =>
      [f.pivot[0] - f.bounds[0], f.bounds[2] - f.pivot[0]].map(
        (v) => v / clips[name].sourceBodyHeight,
      ),
    ),
  ),
);
const geometry = (mobile = false) => {
  const body = mobile ? 36 : 48,
    viewport = mobile ? 640 : 800;
  const left = mobile ? 18 : 56,
    right = mobile ? 356 : 1240;
  const original = {
    top: 795,
    bottom: 1325,
    lane: mobile ? 46 : 80,
    tieX: mobile ? 72 : 120,
    body: mobile ? 56 : 80,
    viewport,
  };
  const scene = (id, landing, movement, gesture = "idle") => ({
    id,
    recipe: "header",
    gesture,
    descent: movement,
    landing,
    left,
    right,
    obstacles: [
      {
        left: left + 56,
        right: left + (mobile ? 210 : 295),
        top: landing - 51,
        bottom: landing - 16,
      },
    ],
  });
  return {
    body,
    viewport,
    maxScroll: mobile ? 3720 : 2840,
    scenes: [
      {
        id: "experience",
        recipe: "timeline",
        gesture: "idle",
        descent: "elevator",
        landing: originalExperienceAt(
          originalExperienceAt(0, original).start,
          original,
        ).y,
        left,
        right,
        obstacles: [],
        original,
      },
      scene("work", 1590, "crawl"),
      {
        ...scene("publications", mobile ? 2930 : 2060, "elevator", "curious"),
        obstacles: [
          {
            left: left + 56,
            right: left + (mobile ? 185 : 250),
            top: (mobile ? 2930 : 2060) - 51,
            bottom: (mobile ? 2930 : 2060) - 16,
          },
          {
            left: right - 170,
            right: right - 56,
            top: (mobile ? 2930 : 2060) - 49,
            bottom: (mobile ? 2930 : 2060) - 17,
          },
        ],
      },
      scene("writing", mobile ? 3590 : 2720, "slide"),
      {
        ...scene("contact", mobile ? 3950 : 3120, "elevator", "wave"),
        recipe: "finish",
        obstacles: [],
      },
    ],
  };
};
function verify(route, g) {
  assert.ok(route.segments.length);
  for (let i = 0; i < route.segments.length; i++) {
    const s = route.segments[i];
    assert.ok(
      s.end > s.start,
      `${s.scene}/${s.action} has a positive scroll interval`,
    );
    assert.ok(Number.isFinite(s.length));
    assert.ok(
      s.start >= route.start - 1e-8 && s.end <= route.end + 1e-8,
      `${s.scene} is reachable`,
    );
    if (s.action === "walk") {
      assert.equal(s.from.y, s.to.y, "feet stay on a horizontal line");
      assert.equal(
        s.from.y,
        g.scenes.find((item) => item.id === s.scene).landing,
        "walk uses the measured heading line",
      );
    }
    if (["abseil", "elevator", "crawl", "crawl-front", "slide"].includes(s.action))
      assert.equal(s.from.x, s.to.x, "descent is vertical");
    assert.ok(
      ["walk", "hop", "abseil", "elevator", "crawl", "crawl-front", "slide", "rest"].includes(
        s.action,
      ),
    );
    if (i) {
      const prev = route.segments[i - 1];
      assert.deepEqual(
        s.from,
        prev.to,
        `${s.scene} connects without a positional seam`,
      );
      assert.ok(Math.abs(s.start - prev.end) < 1e-7, "no scroll seam");
    }
    const midpoint = (s.start + s.end) / 2,
      at = sampleRoute(route, midpoint);
    sampleRoute(route, route.end);
    assert.deepEqual(
      sampleRoute(route, midpoint),
      at,
      "deep links and reversal are deterministic",
    );
  }
  assert.equal(sampleRoute(route, 0).visible, false);
  assert.equal(sampleRoute(route, route.end + 500).segment.scene, "contact");
  assert.deepEqual(
    { x: sampleRoute(route, route.end).x, y: sampleRoute(route, route.end).y },
    route.segments.at(-1).to,
  );
}
test("desktop and mobile keep Experience abseiling, Work crawling and Notes sliding", () => {
  for (const mobile of [false, true]) {
    const g = geometry(mobile),
      r = buildRoute(g);
    verify(r, g);
    for (const action of ["abseil", "elevator", "crawl", "slide"])
      assert.ok(r.segments.some((s) => s.action === action));
    assert.deepEqual(r.segments.filter(s => s.action === "abseil").map(s => s.scene), ["experience"]);
    assert.equal(
      r.segments[0].scene,
      "experience",
      "no new scenery through the introduction",
    );
  }
});
test("heading jumps clear titles and links with the full sprite width in both directions", () => {
  for (const mobile of [false, true]) {
    const g = geometry(mobile),
      r = buildRoute(g);
    for (const s of r.segments.filter(
      (s) => s.header && ["walk", "hop"].includes(s.action),
    )) {
      const item = g.scenes.find((item) => item.id === s.scene);
      for (let i = 0; i <= 200; i++) {
        const p = pointAt(s, i / 200);
        for (const box of item.obstacles) {
          if (
            p.x + g.body * spriteRadius > box.left &&
            p.x - g.body * spriteRadius < box.right
          )
            assert.ok(
              p.y <= box.top - 8,
              `${mobile ? "mobile" : "desktop"} ${s.scene}: feet clear heading at x=${p.x}, y=${p.y}`,
            );
        }
      }
    }
  }
});
test("Experience preserves the first version’s scroll position, lane and endpoints", () => {
  for (const mobile of [false, true]) {
    const g = geometry(mobile),
      r = buildRoute(g),
      old = g.scenes[0].original;
    const s = r.segments.find((s) => s.original);
    assert.equal(
      s.start,
      Math.max(164, old.top + old.body - old.viewport * 0.6),
    );
    assert.equal(s.end, old.bottom - old.viewport * 0.6);
    for (const scroll of [s.start + 1, (s.start + s.end) / 2, s.end - 1]) {
      const p = sampleRoute(r, scroll);
      assert.equal(p.x, old.lane);
      assert.equal(p.y - scroll, old.viewport * 0.6);
      assert.equal(p.segment.original.tieX, old.tieX);
    }
    // Replacing later recipes cannot retime the original abseil.
    g.scenes[1].recipe = "perch";
    assert.deepEqual(buildRoute(g).segments[0], s);
  }
});
test("inserting, removing and changing sections reconnects the header route", () => {
  const g = geometry();
  g.scenes.splice(3, 0, {
    ...g.scenes[2],
    id: "teaching",
    landing: 2540,
    recipe: "perch",
    descent: "crawl",
    obstacles: [],
  });
  verify(buildRoute(g), g);
  g.scenes = g.scenes.filter((s) => s.id !== "writing");
  verify(buildRoute(g), g);
  g.scenes[1].recipe = "perch";
  verify(buildRoute(g), g);
  assert.equal(recipe("unknown"), "perch");
  assert.equal(recipe("gallery"), "header");
  assert.equal(descent("ladder"), "elevator");
});
test("expanded Experience and taller viewports preserve its original descent and reachable footer", () => {
  for (const viewport of [640, 800, 1200, 1800]) {
    const g = geometry();
    const difference = viewport - g.viewport;
    g.viewport = viewport;
    g.maxScroll -= difference;
    g.scenes[0].original.viewport = viewport;
    g.scenes[0].landing = originalExperienceAt(
      originalExperienceAt(0, g.scenes[0].original).start,
      g.scenes[0].original,
    ).y;
    g.scenes[0].original.bottom += 700;
    for (const s of g.scenes.slice(1)) {
      s.landing += 700;
      s.obstacles = s.obstacles.map((b) => ({
        ...b,
        top: b.top + 700,
        bottom: b.bottom + 700,
      }));
    }
    g.maxScroll += 700;
    verify(buildRoute(g), g);
  }
});
test("short pages without a timeline keep every section reachable without adding scroll height", () => {
  for (const maxScroll of [80, 300, 1200]) {
    const g = geometry();
    g.scenes.shift();
    g.viewport = 1800;
    g.maxScroll = maxScroll;
    const r = buildRoute(g);
    verify(r, g);
    assert.equal(r.end, maxScroll);
  }
});

test("portrait exit plants both feet before a continuous parachute drift into Experience, in either direction", () => {
  for (const mobile of [false, true]) {
    const g = geometry(mobile);
    g.portrait = { left: mobile ? 18 : 48, top: 134, size: 96, dockLeft: mobile ? 18 : 48, dockTop: 12, travel: 210 };
    const r = buildRoute(g), [step, flight, experience] = r.segments;
    assert.equal(step.action, "step-out");
    assert.equal(flight.action, "parachute");
    assert.equal(experience.action, "abseil");
    assert.ok(step.start > 0 && step.end < g.portrait.travel);
    const circle = portraitAt(step.start, g.portrait);
    assert.equal(step.from.x, circle.x, "character starts inside the actual moving portrait");
    assert.deepEqual(pointAt(step, 1), flight.from);
    assert.deepEqual(flight.to, experience.from);
    assert.ok(pointAt(flight, 0.5).x > Math.max(flight.from.x, flight.to.x), "parachute drifts outward over content");
    for (const boundary of [step.end, flight.end]) {
      const before = sampleRoute(r, boundary - 0.001), after = sampleRoute(r, boundary + 0.001);
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 0.1, "no handoff jump");
    }
    const frames = [.29, .43, .57, .71].map(exitFrame);
    assert.deepEqual(frames, [0, 1, 2, 3]);
    assert.equal(sampleRoute(r, step.start - 1).visible, false);
    assert.deepEqual(sampleRoute(r, step.start), sampleRoute(r, step.start));
  }
});

test("front-facing crawling stays selectable without appearing in the default Notes route", () => {
  const g = geometry();
  assert.ok(!buildRoute(g).segments.some(s => s.action === "crawl-front"));
  g.scenes.find(s => s.id === "writing").descent = descent("crawl-front");
  assert.ok(buildRoute(g).segments.some(s => s.scene === "writing" && s.action === "crawl-front"));
  assert.equal(descent("parachute"), "parachute");
});

test("both side lanes contain the full sprite at phone, tablet and desktop widths", () => {
  for (const width of [320, 360, 390, 700, 768, 1024, 1440]) {
    const g = geometry(width <= 700), pad = width <= 380 ? 18 : width <= 700 ? 24 : 32;
    g.width = width;
    for (const s of g.scenes) {
      const lanes = safeLanes(pad + 44 - 32 - g.body / 2, width - pad - 44 + 32 + g.body / 2, width, g.body);
      s.left = lanes.left; s.right = lanes.right;
      s.obstacles = [{ left: pad + 44, right: width - pad - 44, top: s.landing - 42, bottom: s.landing - 8 }];
    }
    const r = buildRoute(g);
    for (const s of r.segments.filter(s => !s.original)) for (let i = 0; i <= 100; i++) {
      const p = pointAt(s, i / 100);
      assert.ok(p.x - g.body * 2 / 3 >= 0, `${width}: left edge stays visible`);
      assert.ok(p.x + g.body * 2 / 3 <= width, `${width}: right edge stays visible`);
    }
  }
  assert.equal(descent("spider"), "crawl", "existing editor values migrate to real wall crawling");
});
