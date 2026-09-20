import settings from "../../data/avatar-settings.json";
import configuration from "../../data/avatar-route.json";
import { BODY, clips, type AvatarRenderer } from "./renderer";
import { clamp, ease, frameAt, gait, mix } from "./core";
import { ScrollMotion } from "./scroll-motion";
import {
  buildRoute,
  originalExperienceAt,
  pointAt,
  recipe,
  descent,
  exitFrame,
  exitAt,
  portraitAt,
  sampleRoute,
  type Gesture,
  type Route,
  type Scene,
  type Segment,
  type OriginalExperience,
} from "./route";

export function mountJourney(
  layer: HTMLElement,
  renderer: AvatarRenderer,
  animated: () => boolean,
) {
  const canvas = layer.querySelector<HTMLCanvasElement>("canvas")!,
    ctx = canvas.getContext("2d");
  const rope = layer.querySelector<SVGPathElement>(".avatar-rope")!,
    anchor = layer.querySelector<SVGCircleElement>(".avatar-rope-anchor")!,
    platform = layer.querySelector<SVGPathElement>(".avatar-platform")!;
  const parachute = layer.querySelector<SVGGElement>(".avatar-parachute")!,
    sail = layer.querySelector<SVGGElement>(".avatar-parachute-sail")!,
    cords = layer.querySelector<SVGPathElement>(".avatar-parachute-lines")!;
  const page = document.querySelector<HTMLElement>("main.page")!;
  const portrait = document.querySelector<HTMLElement>("#portrait")!;
  const handoff = layer.querySelector<HTMLCanvasElement>(".avatar-handoff")!;
  const handoffContext = handoff.getContext("2d");
  const exitCircle = layer.querySelector<SVGCircleElement>(".avatar-exit-circle")!;
  const exitOpening = layer.querySelector<SVGRectElement>(".avatar-exit-opening")!;
  if (!ctx) return { refresh() {} };
  ctx.imageSmoothingEnabled = false;
  const motion = new ScrollMotion(Math.max(0, window.scrollY));
  let route: Route | undefined,
    headerHeight = 76,
    raf = 0,
    settle = 0,
    version = 0,
    painted = "";
  let bodyHeight = 48,
    originalBody = 80,
    previousScroll = window.scrollY,
    previousTime = performance.now(),
    previousDistance: number | undefined;
  let direction = 1,
    speed = 0,
    pace: "walk" | "run" = "walk",
    lastMove = -Infinity,
    travelled = 0,
    facing = 1;
  let originalPhase = 0,
    originalSpeed = 0,
    originalPace: "walk" | "run" = "walk";
  let grips: number[][] = [];
  let hop:
    | {
        segment: Segment;
        progress: number;
        from: number;
        began: number;
        landing?: number;
        direction: number;
      }
    | undefined;
  const headings = new Map<string, { el: HTMLElement; baseline: number }>();
  let exiting = false, handoffReady = false;
  function setExiting(next: boolean) {
    if (next === exiting) return;
    exiting = next;
    handoffReady = false;
    if (next && portrait.dataset.avatar === "true" && handoffContext) {
      handoffContext.clearRect(0, 0, 96, 96);
      handoffContext.drawImage(portrait.querySelector("canvas")!, 0, 0);
      handoffReady = true;
    }
    portrait.dataset.journeyExit = String(next);
    portrait.dispatchEvent(new CustomEvent("avatar:exit", { detail: next }));
    if (!next) handoff.hidden = true;
  }
  const hide = () => {
    layer.hidden = true;
    setExiting(false);
    painted = "";
    version++;
  };
  const rect = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top + scrollY,
      bottom: r.bottom + scrollY,
    };
  };
  function measure() {
    const box = rect(page),
      style = getComputedStyle(page),
      pad = parseFloat(style.paddingLeft) || 0;
    bodyHeight = innerWidth <= 700 ? 36 : 48;
    originalBody =
      innerWidth <= 700
        ? settings.bodyHeight.mobile
        : settings.bodyHeight.desktop;
    headerHeight =
      document
        .querySelector<HTMLElement>(".site-header")
        ?.getBoundingClientRect().height || 76;
    const originalLane = innerWidth <= 700 ? 44 : 64;
    const choices = configuration.scenes as Record<
      string,
      { recipe: string; gesture: string; descent?: string }
    >;
    const scenes: Scene[] = [];
    headings.clear();
    for (const el of page.querySelectorAll<HTMLElement>(
      ":scope > .section, :scope > .footer",
    )) {
      const choice = choices[el.id],
        r = rect(el),
        css = getComputedStyle(el),
        heading = el.querySelector<HTMLElement>(".section-heading");
      const h = heading?.getBoundingClientRect();
      // The section's padding gives the normal-flow position even when its
      // heading is currently sticky. Text boxes are relative to that heading.
      const top = r.top + (parseFloat(css.paddingTop) || 0);
      const baseline = heading && h ? top + h.height - 1 : r.top;
      const obstacles =
        heading && h
          ? [...heading.children].map((child) => {
              const b = (child as HTMLElement).getBoundingClientRect();
              return {
                left: b.left,
                right: b.right,
                top: top + b.top - h.top,
                bottom: top + b.bottom - h.top,
              };
            })
          : [];
      if (heading) headings.set(el.id, { el: heading, baseline });
      const leftEdge = h?.left ?? r.left + (parseFloat(css.paddingLeft) || 0),
        rightEdge = h?.right ?? r.right - (parseFloat(css.paddingRight) || 0);
      const clearance = 32 + bodyHeight * 0.5;
      let original: OriginalExperience | undefined;
      const timeline = el.querySelector<HTMLElement>(".timeline");
      if (el.id === "experience" && timeline) {
        const t = rect(timeline),
          top = t.top + 35;
        original = {
          top,
          bottom: Math.max(
            top + originalBody + 30,
            t.top + timeline.offsetHeight - 35,
          ),
          lane: box.left + pad + originalLane / 2,
          tieX: t.left + 4,
          body: originalBody,
          viewport: innerHeight,
        };
      }
      const gesture = el.dataset.avatarGesture || choice?.gesture || "idle";
      scenes.push({
        id: el.id,
        recipe: original
          ? "timeline"
          : recipe(
              el.dataset.avatarRecipe ||
                choice?.recipe ||
                configuration.defaultRecipe,
            ),
        descent: descent(
          el.dataset.avatarDescent || choice?.descent || "elevator",
        ),
        gesture: ["idle", "curious", "wave"].includes(gesture)
          ? (gesture as Gesture)
          : "idle",
        landing: original
          ? originalExperienceAt(
              originalExperienceAt(0, original).start,
              original,
            ).y
          : baseline,
        left: leftEdge - clearance,
        right: rightEdge + clearance,
        obstacles,
        original,
      });
    }
    const identity = document.querySelector<HTMLElement>(".identity-anchor")!;
    const home = rect(identity);
    const dock = document.querySelector<HTMLElement>(".identity-dock")?.getBoundingClientRect();
    const homeSize = Number(portrait.dataset.homeSize) || (innerWidth <= 700 ? 76 : 96);
    const homeHeight = Number(portrait.dataset.homeHeight) || identity.offsetHeight || homeSize;
    route = buildRoute({
      body: bodyHeight,
      width: document.documentElement.clientWidth || innerWidth,
      viewport: innerHeight,
      maxScroll: Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight,
      ),
      scenes,
      portrait: {
        left: home.left,
        top: home.top + (homeHeight - homeSize) / 2,
        size: homeSize,
        dockLeft: dock?.left ?? home.left,
        dockTop: dock ? dock.top + (dock.height - 40) / 2 : 12,
        travel: Number(portrait.dataset.dockTravel) || Math.max(160, home.top - headerHeight + homeHeight),
      },
    });
    layer.style.clipPath = `inset(${Math.ceil(headerHeight)}px 0 0)`;
  }
  async function draw(
    clip: string,
    frame: number,
    mirrored: boolean,
    grounded = false,
  ) {
    const key = `${clip}:${frame}:${renderer.outfit}:${mirrored}:${grounded}`;
    if (painted === key) return;
    painted = key;
    const token = ++version;
    try {
      const pose = await renderer.pose(clip, frame, false, mirrored);
      if (token !== version || !animated() || document.hidden) return;
      ctx!.clearRect(0, 0, BODY.width, BODY.height);
      const source = clips[clip],
        cell = source.frames[frame];
      const offset = grounded
        ? ((cell.pivot[1] - cell.bounds[3]) * BODY.body) /
          source.sourceBodyHeight
        : 0;
      ctx!.drawImage(pose.canvas, 0, offset);
      grips = pose.grips;
      schedule();
    } catch {
      hide();
    }
  }
  function update(now: number) {
    raf = 0;
    if (!animated() || document.hidden) {
      hide();
      return;
    }
    if (!route) measure();
    const actualScroll = Math.max(0, window.scrollY),
      scroll = motion.follow(actualScroll, now, innerHeight * 0.65),
      sample = sampleRoute(route!, scroll),
      delta = scroll - previousScroll,
      dt = clamp(now - previousTime, 16, 100);
    const moved =
        previousDistance === undefined
          ? 0
          : sample
            ? sample.distance - previousDistance
            : 0,
      jumped = Math.abs(delta) > innerHeight * 0.65;
    // Original abseil phase and speed calculation, including its stride factors.
    if (Math.abs(delta) > 0.3) {
      direction = Math.sign(delta);
      lastMove = now;
      originalSpeed += ((Math.abs(delta) / dt) * 1000 - originalSpeed) * 0.45;
    }
    const moving = now - lastMove < 140;
    if (!moving) {
      speed = 0;
      originalSpeed = 0;
    }
    originalPace = gait(originalPace, originalSpeed);
    originalPhase +=
      Math.abs(delta) /
      (((originalPace === "run" ? 142 : 88) * originalBody) / 96);
    if (previousDistance === undefined || jumped)
      travelled = sample?.distance || 0;
    else travelled += Math.abs(moved);
    if (Math.abs(moved) > 0.05 && !jumped)
      speed += ((Math.abs(moved) / dt) * 1000 - speed) * 0.45;
    pace = gait(pace, speed);
    previousScroll = scroll;
    previousTime = now;
    previousDistance = sample?.distance;
    if (!sample?.visible) {
      hide();
      if (motion.pending) schedule();
      return;
    }
    const s = sample.segment;
    let progress = sample.progress,
      x = sample.x,
      y = sample.y - scroll,
      hopping = false;
    // The wheel eases the route and limb phase, while document attachments
    // stay on their real elements. Free travel uses the eased viewport pose.
    if (s.original)
      y = originalExperienceAt(actualScroll, s.original).y - actualScroll;
    if (s.exit) {
      const point = exitAt(s.exit, actualScroll, progress, s.to.x, s.body!);
      x = point.x;
      y = point.y - actualScroll;
    }
    const height = s.original?.body ?? (s.endBody
      ? mix(s.body!, s.endBody, ease(clamp((progress - 0.92) / 0.08)))
      : s.body) ?? bodyHeight;
    let scale = height / BODY.body,
      clip = "idle",
      frame = 0,
      mirror = false,
      grounded = false;
    if (s.action === "hop") {
      if (hop?.segment !== s)
        hop = { segment: s, progress, from: progress, began: now, direction };
      if (
        (!moving && hop.landing === undefined) ||
        (hop.landing !== undefined &&
          Math.abs(delta) > 0.1 &&
          direction !== hop.direction)
      ) {
        hop.from = hop.progress;
        hop.began = now;
        hop.landing = direction > 0 ? 1 : 0;
        hop.direction = direction;
      }
      if (hop.landing !== undefined) {
        const t = clamp((now - hop.began) / 220);
        progress = mix(hop.from, hop.landing, ease(t));
        hopping = t < 1;
      }
      hop.progress = progress;
      const p = pointAt(s, progress);
      x = p.x;
      y = p.y - scroll;
    } else hop = undefined;
    // Follow the real header line (including its sticky position), never a
    // separate ledge or the top of a project image.
    const header = s.header ? headings.get(s.header) : undefined;
    if (header)
      y +=
        header.el.getBoundingClientRect().bottom -
        1 -
        (header.baseline - scroll);
    if (Math.abs(s.to.x - s.from.x) > 0.1)
      facing = Math.sign(s.to.x - s.from.x) * direction;
    if (s.action === "walk") {
      clip = moving && !jumped ? pace : "idle";
      mirror = facing < 0;
      frame =
        clip === "idle"
          ? 0
          : frameAt(
              travelled / (((pace === "run" ? 142 : 88) * height) / 96),
              clips[clip].sequence,
            );
    } else if (s.action === "hop") {
      clip = progress === 0 || progress === 1 ? "idle" : "run";
      frame =
        clip === "idle" ? 0 : progress < 0.12 ? 1 : progress > 0.88 ? 0 : 2;
      mirror = facing < 0;
      grounded = true;
    } else if (s.action === "abseil") {
      clip = direction > 0 ? "abseil" : "climb";
      frame = frameAt(
        s.original ? originalPhase * 0.6 : travelled / (height * 0.7),
        clips[clip].sequence,
      );
    } else if (s.action === "step-out") {
      clip = progress < 0.28 ? "idle" : "step-out";
      frame = clip === "idle" ? 0 : exitFrame(progress);
      if (progress < 0.28 && s.exit) {
        const circle = portraitAt(actualScroll, s.exit), source = clips.idle;
        const pose = source.frames[0], crop = pose.portrait!;
        const closeupScale = circle.size * source.sourceBodyHeight / (crop[2] * BODY.body);
        const t = ease(progress / 0.28);
        scale = mix(closeupScale, scale, t);
        // The first drawing is exactly the portrait crop at the same position.
        // Zoom out within that circle before either foot crosses its lower rim.
        x = mix(circle.x + (pose.pivot[0] - crop[0] - crop[2] / 2) * circle.size / crop[2], x, t);
        y = mix(circle.y + (pose.pivot[1] - crop[1] - crop[3] / 2) * circle.size / crop[2], y, t);
      }
    } else if (s.action === "parachute") {
      // Hold the last planted pose while the canopy unfurls, then suspend the
      // body from its raised hands. The same poses retrace on reverse scroll.
      clip = progress < 0.035 && s.scene === "portrait" ? "step-out" : "parachute";
      frame = clip === "step-out" ? 3 : progress < 0.18 ? 0 : progress > 0.88 ? 3
        : frameAt(sample.distance / (height * 3), clips.parachute.sequence);
    } else if (s.action === "slide") {
      clip = direction > 0 ? "slide" : "crawl";
      frame = direction > 0
        ? (progress < 0.12 ? 0 : progress > 0.88 ? 3 : progress > 0.72 ? 2 : 1)
        : frameAt(sample.distance / (height * 0.8), clips.crawl.sequence);
    } else if (s.action === "crawl" || s.action === "crawl-front") {
      clip = s.action;
      // Signed route distance means reversing scroll reverses the actual
      // alternating hand/foot contacts instead of replaying an ascent forwards.
      frame = frameAt(sample.distance / (height * 0.8), clips[clip].sequence);
      mirror = s.action === "crawl" && x < innerWidth / 2;
    } else if (s.gesture === "curious") {
      clip = "expressions";
      frame = 3;
    } else if (s.gesture === "wave") {
      clip = "wave";
      frame = frameAt(
        Math.min(0.999, progress * 1.5),
        [0, 1, 2, 3, 2, 1, 0, 0],
      );
    }
    layer.hidden = false;
    setExiting(Boolean(s.exit));
    layer.style.zIndex = s.scene === "portrait" ? "46" : s.original ? "18" : "30";
    layer.style.opacity = "1";
    if (s.exit) {
      const circle = portraitAt(actualScroll, s.exit);
      exitCircle.setAttribute("cx", String(circle.x));
      exitCircle.setAttribute("cy", String(circle.y));
      exitCircle.setAttribute("r", String(circle.size / 2));
      exitOpening.setAttribute("y", String(progress < 0.28 ? innerHeight + 1 : circle.y + circle.size * 0.38));
      layer.style.clipPath = "url(#avatar-exit-mask)";
      handoff.hidden = !handoffReady || progress >= 0.14;
      if (!handoff.hidden) {
        handoff.style.width = handoff.style.height = `${circle.size}px`;
        handoff.style.transform = `translate(${circle.x - circle.size / 2}px, ${circle.y - circle.size / 2}px)`;
        handoff.style.opacity = String(1 - ease(clamp(progress / 0.14)));
      }
    } else layer.style.clipPath = s.scene === "portrait" ? "none" : `inset(${Math.ceil(headerHeight)}px 0 0)`;
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const canopyOpen = s.action === "parachute"
      ? ease(clamp(progress / 0.14)) * (1 - ease(clamp((progress - 0.90) / 0.10)))
      : 0;
    // The last guard also covers enlarged browser text and changed outfits.
    const inset = Math.max(height * 2 / 3, 108 * scale * canopyOpen) + 2;
    if (!s.exit) x = clamp(x, inset, viewportWidth - inset);
    Object.assign(layer.dataset, {
      scene: s.scene,
      zone: s.action,
      action: clip,
      direction: direction > 0 ? "down" : "up",
      x: x.toFixed(2),
      y: (y + actualScroll).toFixed(2),
      progress: progress.toFixed(3),
      frame: String(frame),
      scroll: scroll.toFixed(2),
    });
    canvas.style.width = `${BODY.width * scale}px`;
    canvas.style.height = `${BODY.height * scale}px`;
    canvas.style.transformOrigin = "center center";
    canvas.style.transform = `translate(${Math.round(x - BODY.x * scale)}px, ${Math.round(y - BODY.y * scale)}px)${mirror ? " scaleX(-1)" : ""}`;
    void draw(clip, frame, mirror, grounded);
    const onRope = s.action === "abseil";
    rope.style.display = onRope ? "" : "none";
    anchor.style.display = onRope ? "" : "none";
    if (onRope) {
      const top = (s.original?.top ?? s.from.y - height) - actualScroll;
      const hands = grips.length
        ? grips
        : [
            [BODY.x, BODY.y - 60],
            [BODY.x - 4, BODY.y - 40],
          ];
      const [a, b] = hands.map(([hx, hy]) => [
        x + (hx - BODY.x) * scale,
        y + (hy - BODY.y) * scale,
      ]);
      // Restore the original anchor, top elbow, hand contacts and clipped tail.
      rope.setAttribute(
        "d",
        `M ${s.original?.tieX ?? x} ${top} L ${x} ${top} L ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${x} ${Math.min(innerHeight + 30, (s.original?.bottom ?? s.to.y) - actualScroll)}`,
      );
      anchor.setAttribute("cx", String(x));
      anchor.setAttribute("cy", String(top));
    }
    platform.style.display = s.action === "elevator" ? "" : "none";
    if (s.action === "elevator") {
      const half = height * 0.32;
      platform.setAttribute("d", `M ${x - half} ${y + 1} H ${x + half}`);
    }
    parachute.style.display = s.action === "parachute" ? "" : "none";
    if (s.action === "parachute") {
      const open = canopyOpen;
      parachute.style.opacity = String(clamp(open * 4));
      parachute.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
      sail.setAttribute("transform", `translate(0 -98) scale(${open}) translate(0 98)`);
      // Use the selected frame's measured hands immediately; image decoding
      // must not leave the lines attached to a stale pose on fast scrolling.
      const source = clips[clip], pose = source.frames[frame];
      const hands = (pose.grips ?? [[pose.pivot[0] - 40, pose.pivot[1] - 400], [pose.pivot[0] + 40, pose.pivot[1] - 400]])
        .map(([gx, gy]) => [(gx - pose.pivot[0]) * BODY.body / source.sourceBodyHeight,
          (gy - pose.pivot[1]) * BODY.body / source.sourceBodyHeight]);
      cords.setAttribute("d", [-108, -36, 36, 108].map((edge, i) => {
        const hand = hands[i < 2 ? 0 : 1];
        return `M ${edge * open} ${-98 - 24 * open} L ${hand[0]} ${hand[1]}`;
      }).join(" "));
    }
    if (moving) {
      window.clearTimeout(settle);
      settle = window.setTimeout(schedule, 160);
    }
    if (hopping || motion.pending) schedule();
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(update);
  }
  function refresh() {
    route = undefined;
    previousScroll = window.scrollY;
    motion.reset(Math.max(0, window.scrollY));
    previousTime = performance.now();
    previousDistance = undefined;
    speed = 0;
    originalSpeed = 0;
    lastMove = -Infinity;
    painted = "";
    hop = undefined;
    version++;
    window.clearTimeout(settle);
    if (!animated() || document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      hide();
    } else schedule();
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("wheel", event => motion.wheel(event, performance.now()), { passive: true });
  // A different input source takes ownership immediately.
  window.addEventListener("touchstart", () => motion.reset(Math.max(0, window.scrollY)), { passive: true });
  window.addEventListener("pointerdown", () => motion.reset(Math.max(0, window.scrollY)), { passive: true });
  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key))
      motion.reset(Math.max(0, window.scrollY));
  });
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("identity:measure", refresh);
  document.addEventListener("visibilitychange", refresh);
  document.addEventListener("toggle", refresh, true);
  page.addEventListener("load", refresh, true);
  document.fonts?.ready.then(refresh);
  if ("ResizeObserver" in window) new ResizeObserver(refresh).observe(page);
  if ("MutationObserver" in window)
    new MutationObserver(refresh).observe(page, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-avatar-recipe",
        "data-avatar-gesture",
        "data-avatar-descent",
      ],
    });
  refresh();
  return { refresh };
}
