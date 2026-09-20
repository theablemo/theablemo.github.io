import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { initialTravel, advanceTravel, settleTravel, sequenceFrame, routeProgress } from './fixtures/locomotion/core.mjs';
import { placement } from './fixtures/locomotion/placement.mjs';

const base = new URL('./fixtures/locomotion/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)));

test('gait phase follows distance, including at exact cycle boundaries', () => {
  const options = { trackLength: 880, mode: 'walk' };
  const single = advanceTravel(initialTravel(), .3, 480, options);
  let many = initialTravel();
  for (let i = 1; i <= 30; i++) many = advanceTravel(many, i / 100, i * 16, options);
  assert.ok(Math.abs(single.phase - many.phase) < 1e-8);
  assert.equal(sequenceFrame(manifest.clips.walk, single.phase), 0);
  assert.equal(sequenceFrame(manifest.clips.walk, many.phase), 0);
  for (let i = 0; i < 6; i++) assert.equal(sequenceFrame(manifest.clips.walk, i / 6), manifest.clips.walk.sequence[i]);
});

test('reversal keeps the position and phase; stillness does not advance a pose', () => {
  const options = { trackLength: 700, mode: 'walk' };
  const right = advanceTravel(initialTravel(), .1, 100, options);
  const left = advanceTravel(right, .05, 200, options);
  assert.equal(left.direction, -1);
  assert.equal(left.progress, .05);
  assert.ok(Math.abs(left.phase - ((right.phase + 35 / 88) % 1)) < 1e-8);
  assert.strictEqual(advanceTravel(left, .05, 300, options), left);
  assert.equal(settleTravel(left, 350).action, 'idle');
});

test('automatic pace, reduced motion and route endpoints', () => {
  const start = initialTravel();
  assert.equal(advanceTravel(start, .5, 16).action, 'run');
  assert.equal(advanceTravel(start, .001, 100).action, 'walk');
  assert.equal(advanceTravel(start, .8, 20, { reduced: true }).action, 'idle');
  assert.equal(advanceTravel(start, 4, 100).progress, 1);
  assert.equal(advanceTravel(start, -4, 100).progress, 0);
  assert.equal(routeProgress(250, 100, 500, 200), .5);
  assert.equal(routeProgress(0, 100, 100, 300), 0);
  assert.equal(routeProgress(900, 100, 500, 200), 1);
});

test('atlases and virtual ground preserve airborne frames; Current master is intact', () => {
  for (const [name, clip] of Object.entries(manifest.clips)) {
    assert.ok(existsSync(new URL(clip.file, base)));
    for (const frame of clip.frames) {
      assert.ok(frame.pivot.every(Number.isFinite));
      if (name !== 'idle') {
        assert.ok(frame.source[0] + frame.source[2] <= clip.width);
        assert.ok(frame.source[1] + frame.source[3] <= clip.height);
      }
      if (frame.airborne) assert.ok(frame.pivot[1] > frame.bounds[3] + 60);
      const placed = placement(frame, clip.sourceBodyHeight, 96, 200, 184);
      assert.ok(Math.abs(placed.y + frame.pivot[1] * placed.scale - 184) < 1e-8);
    }
  }
  const hash = createHash('sha256').update(readFileSync(new URL('../../../public/assets/avatar/current.png', base))).digest('hex');
  assert.equal(hash, '24b9c6cbd79eedddf5365b9fa666bc1280df7dcf09e06bf62bcc1093a6b79b63');
});

async function harness({ reduced = false, failImage = false } = {}) {
  const dom = new JSDOM(readFileSync(new URL('index.html', base), 'utf8'), { runScripts: 'outside-only', url: 'http://127.0.0.1:4325/locomotion/' });
  const { window } = dom;
  const document = window.document;
  let now = 0, nextId = 0, scrollY = 0, hidden = false, intersection;
  const frames = new Map(), timers = new Map();
  const media = { matches: reduced, addEventListener: (_, fn) => { media.change = fn; } };
  window.matchMedia = () => media;
  window.performance.now = () => now;
  window.requestAnimationFrame = (fn) => { frames.set(++nextId, fn); return nextId; };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.setTimeout = (fn, delay) => { timers.set(++nextId, { fn, at: now + delay }); return nextId; };
  window.clearTimeout = (id) => timers.delete(id);
  window.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() { this.fn(); } };
  window.IntersectionObserver = class { constructor(fn) { intersection = fn; } observe() {} };
  window.HTMLCanvasElement.prototype.getContext = () => ({ setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, translate() {}, scale() {}, drawImage() {}, restore() {} });
  window.Image = class { async decode() { if (failImage) throw new Error('Image unavailable'); } };
  window.fetch = async () => ({ ok: true, json: async () => manifest });
  window.console.error = () => {};
  Object.defineProperty(window, 'scrollY', { get: () => scrollY });
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  document.getElementById('travel-route').getBoundingClientRect = () => ({ top: 100 - scrollY, height: 1000 });
  document.getElementById('travel-panel').getBoundingClientRect = () => ({ height: 420 });
  let code = readFileSync(new URL('locomotion.mjs', base), 'utf8');
  code = code.replace(/^import .*;\n/gm, '');
  const run = new window.Function('deps', `return (async () => { const { initialTravel, advanceTravel, settleTravel, sequenceFrame, routeProgress, placement } = deps;\n${code}\n})();`);
  await run({ initialTravel, advanceTravel, settleTravel, sequenceFrame, routeProgress, placement });
  const $ = (id) => document.getElementById(id);
  return { $, dom, frames,
    click: (id) => $(id).click(),
    input: (id, value) => { $(id).value = String(value); $(id).dispatchEvent(new window.Event('input')); },
    step: (ms) => { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } },
    scroll: (y) => { scrollY = y; window.dispatchEvent(new window.Event('scroll')); },
    visibility: (value) => { hidden = value; document.dispatchEvent(new window.Event('visibilitychange')); },
    reduced: (value) => { media.matches = value; media.change(); },
    visible: (value) => intersection([{ isIntersecting: value }]),
  };
}

test('playback controls walk, run, reverse, pause and stop while hidden or offscreen', async () => {
  const h = await harness();
  assert.equal(h.$('fallback').hidden, true);
  h.click('walk');
  for (let i = 0; i < 20; i++) h.step(16);
  assert.equal(h.$('travel-canvas').dataset.action, 'walk');
  const forward = Number(h.$('position').value);
  assert.ok(forward > 0);
  h.click('reverse');
  for (let i = 0; i < 5; i++) h.step(16);
  assert.equal(h.$('travel-canvas').dataset.direction, '-1');
  assert.ok(Number(h.$('position').value) < forward);
  h.click('pause');
  assert.equal(h.frames.size, 0);
  h.click('run'); h.step(16);
  assert.equal(h.$('travel-canvas').dataset.action, 'run');
  h.visibility(true);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('travel-canvas').dataset.action, 'idle');
  h.visibility(false);
  h.click('walk'); h.step(16); h.visible(false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('walk').disabled, true);
  h.dom.window.close();
});

test('native scroll reverses, rests, and reduced motion permits still inspection', async () => {
  const h = await harness();
  h.scroll(300);
  assert.ok(Number(h.$('position').value) > 0);
  h.scroll(200);
  assert.equal(h.$('travel-canvas').dataset.direction, '-1');
  h.step(150);
  assert.equal(h.$('travel-canvas').dataset.action, 'idle');
  h.reduced(true);
  assert.equal(h.$('walk').disabled, true);
  assert.equal(h.$('follow-scroll').getAttribute('aria-pressed'), 'false');
  const before = h.$('position').value;
  h.scroll(800);
  assert.equal(h.$('position').value, before);
  h.input('position', 500);
  assert.equal(h.$('position').value, '500');
  assert.equal(h.$('travel-canvas').dataset.action, 'idle');
  h.input('inspect-clip', 'run'); h.input('pose', 2);
  assert.equal(h.$('pose-label').value, '3 of 6');
  assert.equal(h.frames.size, 0);
  h.dom.window.close();
});

test('initial reduced motion and image failure retain usable static content', async () => {
  const reduced = await harness({ reduced: true });
  assert.equal(reduced.$('walk').disabled, true);
  assert.equal(reduced.frames.size, 0);
  assert.equal(reduced.$('position').disabled, false);
  reduced.dom.window.close();
  const failed = await harness({ failImage: true });
  assert.equal(failed.$('fallback').hidden, false);
  assert.equal(failed.$('walk').disabled, true);
  assert.equal(failed.$('load-state').getAttribute('role'), 'alert');
  failed.dom.window.close();
});
