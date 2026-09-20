import { clamp, ease, mix } from "./core";

export type Point = { x: number; y: number };
export type Rect = { left: number; right: number; top: number; bottom: number };
export type Recipe = "timeline" | "header" | "perch" | "finish";
export type Descent = "abseil" | "elevator" | "crawl" | "crawl-front" | "slide" | "parachute";
export type Action = "walk" | "hop" | Descent | "rest" | "step-out";
export type Gesture = "idle" | "curious" | "wave";
export interface OriginalExperience {
  top: number;
  bottom: number;
  lane: number;
  tieX: number;
  body: number;
  viewport: number;
}
export interface Scene {
  id: string;
  recipe: Recipe;
  descent: Descent;
  gesture: Gesture;
  landing: number;
  left: number;
  right: number;
  obstacles: Rect[];
  original?: OriginalExperience;
}
export interface Geometry {
  body: number;
  viewport: number;
  maxScroll: number;
  scenes: Scene[];
  width?: number;
  portrait?: PortraitDock;
}
export interface PortraitDock {
  left: number;
  top: number;
  size: number;
  dockLeft: number;
  dockTop: number;
  travel: number;
}
export function portraitAt(scroll: number, p: PortraitDock) {
  const t = clamp(scroll / p.travel), size = mix(p.size, 40, t);
  return { x: mix(p.left, p.dockLeft, t) + size / 2,
    y: mix(p.top - scroll, p.dockTop, t) + size / 2, size };
}
export function exitAt(p: PortraitDock, scroll: number, progress: number, lane: number, body: number) {
  const circle = portraitAt(scroll, p);
  // Back away inside the portrait first; then plant the leading foot, bring
  // the trailing foot through, and clear the circle for the parachute to open.
  const step = ease(clamp((progress - 0.28) / 0.56));
  return { x: mix(circle.x, lane, ease(clamp((progress - 0.66) / 0.34))),
    y: circle.y + circle.size / 2 + scroll + body * mix(-0.18, 0.78, step) };
}
export const exitFrame = (progress: number) => Math.min(3, Math.floor(clamp((progress - 0.28) / 0.56) * 4));
// Include the whole render surface, also for a mirrored/splayed crawling pose.
export function safeLanes(left: number, right: number, width: number, body: number) {
  const inset = body * 2 / 3 + 4;
  return { left: clamp(left, inset, width - inset), right: clamp(right, inset, width - inset) };
}
export interface Segment {
  scene: string;
  action: Action;
  from: Point;
  to: Point;
  start: number;
  end: number;
  arc: number;
  gesture: Gesture;
  distance: number;
  length: number;
  header?: string;
  original?: OriginalExperience;
  exit?: PortraitDock;
  body?: number;
  endBody?: number;
}
export interface Route {
  segments: Segment[];
  body: number;
  start: number;
  end: number;
}
export const recipes: Recipe[] = ["timeline", "header", "perch", "finish"];
export function recipe(value: string): Recipe {
  // Existing editor entries migrate to the heading crossing, without image paths.
  if (["gallery", "text", "stroll"].includes(value)) return "header";
  return recipes.includes(value as Recipe) ? (value as Recipe) : "perch";
}
export const descent = (value: string): Descent =>
  value === "spider" ? "crawl" : ["abseil", "elevator", "crawl", "crawl-front", "slide", "parachute"].includes(value)
    ? (value as Descent)
    : "elevator";

// The first version's exact Experience geometry. Kept independent of recipes so
// future edits to header choreography cannot retime or reposition this abseil.
export function originalExperienceAt(scroll: number, g: OriginalExperience) {
  const start = Math.max(164, g.top + g.body - g.viewport * 0.6);
  const end = g.bottom - g.viewport * 0.6;
  return {
    start,
    end,
    x: g.lane,
    y: clamp(scroll + g.viewport * 0.6, g.top + g.body, g.bottom),
    visible: scroll >= start && scroll < end,
  };
}
export function pointAt(s: Segment, progress: number): Point {
  const t = clamp(progress);
  if (s.exit) return exitAt(s.exit, mix(s.start, s.end, t), t, s.to.x, s.body!);
  if (s.action === "parachute") {
    // Drift over the existing content and settle onto the exact next endpoint.
    // Scroll alone drives this curve, so stopping and reversing stay stable.
    const drift = Math.sin(Math.PI * t) * (s.body ?? 48) * 0.85;
    return { x: mix(s.from.x, s.to.x, t) + drift, y: mix(s.from.y, s.to.y, t) };
  }
  // A broad jump clears the entire heading, including the sprite's leading foot.
  const rise = s.arc * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.4);
  return { x: mix(s.from.x, s.to.x, t), y: mix(s.from.y, s.to.y, t) - rise };
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildRoute(g: Geometry): Route {
  const route: Route = {
    segments: [],
    body: g.body,
    start: 4,
    end: Math.max(5, g.maxScroll),
  };
  const scenes = g.scenes.filter((s) => {
    if (!Number.isFinite(s.landing)) return false;
    if (!s.original) return true;
    const span = originalExperienceAt(0, s.original);
    return span.end > span.start && span.start < route.end;
  }).map(s => g.width ? { ...s, ...safeLanes(s.left, s.right, g.width, g.body) } : s);
  if (!scenes.length) return route;
  let cursor = {
      x: scenes[0].original?.lane ?? scenes[0].left,
      y: scenes[0].landing,
    },
    scene = scenes[0].id,
    gesture: Gesture = "idle",
    chain = 0;
  const add = (
    action: Action,
    to: Point,
    arc = 0,
    header?: string,
    original?: OriginalExperience,
  ) => {
    if (action !== "rest" && distance(cursor, to) < 0.001) return;
    if (action === "walk" && Math.abs(cursor.y - to.y) > 0.01)
      throw Error("Walking needs a horizontal header line");
    const segment: Segment = {
      scene,
      action,
      from: { ...cursor },
      to: { ...to },
      start: 0,
      end: 0,
      arc,
      gesture,
      header,
      original,
      distance: chain,
      length: 0,
    };
    let previous = cursor;
    for (let i = 1; i <= 32; i++) {
      const p = pointAt(segment, i / 32);
      segment.length += distance(previous, p);
      previous = p;
    }
    chain += segment.length;
    route.segments.push(segment);
    cursor = { ...to };
  };
  const assign = (first: number, start: number, end: number) => {
    const group = route.segments.slice(first);
    const total = group.reduce(
      (n, s) =>
        n + (s.action === "rest" ? g.body * 0.4 : Math.max(1, s.length)),
      0,
    );
    let t = start;
    for (const s of group) {
      s.start = t;
      t +=
        ((end - start) *
          (s.action === "rest" ? g.body * 0.4 : Math.max(1, s.length))) /
        Math.max(1, total);
      s.end = t;
    }
    if (group.length) group[group.length - 1].end = end;
  };
  const minimum = Math.min(70, (route.end - route.start) / (scenes.length + 2));
  const starts = scenes.map((s) =>
    s.original
      ? originalExperienceAt(0, s.original).start
      : s.landing - g.viewport * 0.72,
  );
  // Later short sections share the remaining scroll range. Experience keeps its
  // original start/end, and is not passed through proportional scene allocation.
  for (let i = starts.length - 1; i >= 0; i--) {
    if (!scenes[i].original)
      starts[i] = Math.min(
        starts[i],
        route.end - minimum * (scenes.length - i),
      );
  }
  for (let i = 0; i < starts.length; i++)
    starts[i] = Math.max(
      starts[i],
      route.start + minimum * (i + 1),
      i ? starts[i - 1] + minimum : 0,
    );
  if (scenes[0].original)
    starts[0] = originalExperienceAt(0, scenes[0].original).start;
  route.start = starts[0];
  // Exit while the identity is still travelling toward the navigation. Both
  // connections share endpoints with the original timeline; no appearance at
  // Experience, no time-dependent offsets, and reverse scroll retraces them.
  if (g.portrait && scenes[0].original) {
    const p = g.portrait, destination = { ...cursor }, body = g.body;
    const begin = Math.min(p.travel * 0.10, starts[0] * 0.12);
    const end = Math.min(p.travel * 0.64, starts[0] - 24);
    if (end > begin + 1) {
      route.start = begin;
      cursor = exitAt(p, begin, 0, destination.x, body);
      scene = "portrait";
      add("step-out", exitAt(p, end, 1, destination.x, body));
      const step = route.segments[0];
      Object.assign(step, { start: begin, end, exit: p, body });
      const flight = route.segments.length;
      add("parachute", destination);
      route.segments[flight].body = body;
      route.segments[flight].endBody = scenes[0].original.body;
      assign(flight, end, starts[0]);
    }
  }
  let onLeft = true;

  const cross = (item: Scene, target: number) => {
    const forward = target > cursor.x;
    const margin = g.body * 0.55 + 12;
    const min = Math.min(cursor.x, target),
      max = Math.max(cursor.x, target);
    const blocks = item.obstacles
      .map((r) => ({
        left: Math.max(min, r.left - margin),
        right: Math.min(max, r.right + margin),
        top: r.top,
        rawLeft: r.left,
        rawRight: r.right,
      }))
      .filter((r) => r.right > r.left)
      .sort((a, b) => a.left - b.left);
    const merged: typeof blocks = [];
    for (const b of blocks) {
      const last = merged[merged.length - 1];
      if (last && b.left <= last.right) {
        last.right = Math.max(last.right, b.right);
        last.top = Math.min(last.top, b.top);
        last.rawLeft = Math.min(last.rawLeft, b.rawLeft);
        last.rawRight = Math.max(last.rawRight, b.rawRight);
      } else merged.push({ ...b });
    }
    for (const b of forward ? merged : merged.reverse()) {
      const near = forward ? b.left : b.right,
        far = forward ? b.right : b.left;
      add("walk", { x: near, y: item.landing }, 0, item.id);
      const safeMargin = Math.max(
        2,
        // Includes the widest run frame (0.372 bodies from its pivot), facing
        // either way, plus a little extra clearance around the artwork.
        Math.min(b.rawLeft - b.left, b.right - b.rawRight) - g.body * 0.4,
      );
      const fraction = clamp(safeMargin / (b.right - b.left), 0.015, 0.5);
      const arc =
        (item.landing - b.top + 10) /
        Math.pow(Math.sin(Math.PI * fraction), 0.4);
      add("hop", { x: far, y: item.landing }, arc, item.id);
    }
    add("walk", { x: target, y: item.landing }, 0, item.id);
  };

  scenes.forEach((item, index) => {
    scene = item.id;
    gesture = item.gesture;
    const next = scenes[index + 1],
      begin = route.segments.length;
    let depart = starts[index];
    if (item.original) {
      const legacy = originalExperienceAt(0, item.original);
      const until = Math.min(legacy.end, route.end);
      if (until > depart) {
        add(
          "abseil",
          {
            x: item.original.lane,
            y: originalExperienceAt(until, item.original).y,
          },
          0,
          undefined,
          item.original,
        );
        assign(begin, depart, until);
        depart = until;
      }
    } else {
      if (item.recipe === "header" || item.recipe === "finish") {
        const target =
          item.recipe === "finish"
            ? mix(item.left, item.right, 0.65)
            : onLeft
              ? item.right
              : item.left;
        cross(item, target);
        if (item.recipe !== "finish") onLeft = !onLeft;
      }
      add("rest", cursor, 0, item.id);
      const nextStart = next
        ? Math.max(depart + 2, starts[index + 1])
        : route.end;
      const duration = next
        ? Math.min(g.viewport * 0.2, (nextStart - depart) * 0.46)
        : nextStart - depart;
      assign(begin, depart, depart + duration);
      depart += duration;
    }
    if (next) {
      const targetX = next.original?.lane ?? (onLeft ? next.left : next.right);
      const connector = route.segments.length;
      // Only a small side-to-side adjustment outside the text column, if needed.
      if (Math.abs(cursor.x - targetX) > 0.1)
        add("hop", { x: targetX, y: cursor.y }, g.body * 0.25);
      add(
        item.recipe === "timeline" && !item.original ? "abseil" : item.descent,
        { x: targetX, y: next.landing },
      );
      starts[index + 1] = Math.max(depart + 0.01, starts[index + 1]);
      assign(connector, depart, starts[index + 1]);
    }
  });
  return route;
}
export function sampleRoute(route: Route, scroll: number) {
  if (!route.segments.length) return null;
  const segment =
    route.segments.find((s) => scroll < s.end) ??
    route.segments[route.segments.length - 1];
  const progress = clamp(
    (scroll - segment.start) / Math.max(0.001, segment.end - segment.start),
  );
  const point = segment.original
    ? originalExperienceAt(scroll, segment.original)
    : pointAt(segment, progress);
  return {
    segment,
    progress,
    x: point.x,
    y: point.y,
    distance: segment.distance + segment.length * progress,
    visible: scroll >= route.start,
  };
}
