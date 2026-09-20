import { initialTravel, advanceTravel, settleTravel, sequenceFrame, routeProgress } from './core.mjs';
import { placement } from './placement.mjs';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('travel-canvas');
const context = canvas.getContext('2d');
const poseCanvas = $('pose-canvas');
const poseContext = poseCanvas.getContext('2d');
const height = 230;
const size = 96;
let width = 900;
let ready = false;
let visible = true;
let manifest, images;
let state = initialTravel();
let playback = null;
let request = 0;
let idleTimer = 0;
let follow = !reduced.matches;
let paused = false;

const trackLength = () => Math.max(1, width - 120);
const options = (mode = 'auto') => ({ trackLength: trackLength(), size, mode, reduced: reduced.matches,
  strides: { walk: manifest.clips.walk.strideAt96, run: manifest.clips.run.strideAt96 } });

function controls() {
  const timed = ready && !reduced.matches && !document.hidden && visible;
  for (const id of ['walk', 'run', 'follow-scroll']) $(id).disabled = !timed;
  $('reverse').disabled = !timed;
  $('pause').disabled = !ready || (!playback && !follow && state.action === 'idle');
  for (const id of ['position', 'pose', 'inspect-clip']) $(id).disabled = !ready;
  $('follow-scroll').setAttribute('aria-pressed', String(follow));
  $('reduced-note').hidden = !reduced.matches;
  $('stage-help').textContent = follow ? 'Scroll down to travel right; scroll up to return. Stop scrolling to rest.' : 'Use the controls, or turn on Follow scroll to connect travel to the page.';
}

function sprite(ctx, action, index, x, y, displaySize, direction = 1) {
  const clip = manifest.clips[action];
  const frame = clip.frames[index];
  const placed = placement(frame, clip.sourceBodyHeight, displaySize, 0, y);
  ctx.save();
  ctx.translate(x, 0);
  // Facing changes independently of the gait's forward-running phase.
  ctx.scale(direction < 0 && action !== 'idle' ? -1 : 1, 1);
  ctx.drawImage(images[action], ...frame.source, placed.x, placed.y, placed.width, placed.height);
  ctx.restore();
}

function draw() {
  if (!ready) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  context.clearRect(0, 0, width, height);
  context.strokeStyle = accent;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(24, 185.5);
  context.lineTo(width - 24, 185.5);
  context.stroke();
  const action = state.action;
  const frame = sequenceFrame(manifest.clips[action], state.phase);
  sprite(context, action, frame, 60 + state.progress * trackLength(), 184, size, state.direction);
  const label = `${paused ? 'Paused · ' : ''}${action === 'idle' ? 'At rest' : action === 'run' ? 'Running' : 'Walking'}${action === 'idle' ? '' : state.direction > 0 ? ' right' : ' left'}`;
  $('action-label').value = label;
  $('position-label').value = state.progress <= 0 ? 'Start' : state.progress >= 1 ? 'End' : `${Math.round(state.progress * 100)}%`;
  $('position').value = String(Math.round(state.progress * 1000));
  canvas.dataset.action = action;
  canvas.dataset.direction = String(state.direction);
  canvas.dataset.frame = String(frame);
  canvas.setAttribute('aria-label', `Current character: ${label.toLowerCase()}, ${Math.round(state.progress * 100)} percent across the track`);
}

function drawPose() {
  if (!ready) return;
  const action = $('inspect-clip').value;
  const index = Number($('pose').value);
  const frame = manifest.clips[action].sequence[index];
  poseContext.clearRect(0, 0, 240, 240);
  sprite(poseContext, action, frame, 120, 216, 160);
  $('pose-label').value = `${index + 1} of 6`;
  poseCanvas.setAttribute('aria-label', `${action === 'walk' ? 'Walking' : 'Running'} pose ${index + 1} of 6`);
}

function stop({ rest = false } = {}) {
  playback = null;
  cancelAnimationFrame(request);
  request = 0;
  clearTimeout(idleTimer);
  paused = !rest && state.action !== 'idle';
  if (rest) state = settleTravel(state, performance.now());
  draw();
  controls();
}

function move(progress, mode = 'auto') {
  paused = false;
  state = advanceTravel(state, progress, performance.now(), options(mode));
  draw();
}

function restSoon() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    state = settleTravel(state, performance.now());
    draw();
    controls();
  }, 140);
}

function tick(now) {
  request = 0;
  if (!playback || document.hidden || reduced.matches || !visible) { stop({ rest: true }); return; }
  const dt = Math.min(60, Math.max(0, now - playback.last));
  playback.last = now;
  const next = state.progress + playback.direction * playback.speed * dt / 1000 / trackLength();
  move(next, playback.mode);
  if (next <= 0 || next >= 1) { stop({ rest: true }); return; }
  request = requestAnimationFrame(tick);
}

function play(mode, direction = state.direction) {
  if (!ready || reduced.matches || document.hidden || !visible) return;
  stop();
  follow = false;
  paused = false;
  if ((direction > 0 && state.progress >= 1) || (direction < 0 && state.progress <= 0)) {
    state = initialTravel(direction > 0 ? 0 : 1, performance.now());
  }
  state = { ...state, action: mode, direction, lastAt: performance.now() };
  playback = { mode, direction, speed: mode === 'walk' ? 72 : 190, last: performance.now() };
  draw();
  controls();
  request = requestAnimationFrame(tick);
}

function onScroll() {
  if (!ready || !follow || reduced.matches || document.hidden || !visible) return;
  const route = $('travel-route').getBoundingClientRect();
  const panelHeight = $('travel-panel').getBoundingClientRect().height;
  const next = routeProgress(scrollY, route.top + scrollY, route.height, panelHeight);
  if (Math.abs(next - state.progress) < 1e-8) return;
  move(next);
  restSoon();
}

function resize() {
  const density = Math.min(3, Math.max(1, devicePixelRatio || 1));
  width = Math.max(180, canvas.parentElement.clientWidth || 900);
  canvas.width = Math.round(width * density);
  canvas.height = height * density;
  context?.setTransform(density, 0, 0, density, 0, 0);
  if (context) context.imageSmoothingEnabled = false;
  poseCanvas.width = 240 * density;
  poseCanvas.height = 240 * density;
  poseCanvas.style.width = '240px';
  poseCanvas.style.height = '240px';
  poseContext?.setTransform(density, 0, 0, density, 0, 0);
  if (poseContext) poseContext.imageSmoothingEnabled = false;
  draw();
  drawPose();
}

$('walk').addEventListener('click', () => play('walk'));
$('run').addEventListener('click', () => play('run'));
$('reverse').addEventListener('click', () => {
  if (playback) play(playback.mode, -playback.direction);
  else {
    follow = false;
    state.direction *= -1;
    paused = state.action !== 'idle';
    draw();
    controls();
  }
});
$('pause').addEventListener('click', () => { follow = false; stop(); });
$('follow-scroll').addEventListener('click', () => {
  follow = !follow;
  stop({ rest: true });
  onScroll();
  controls();
});
$('position').addEventListener('input', () => {
  const progress = Number($('position').value) / 1000;
  follow = false;
  stop();
  move(progress);
  restSoon();
  controls();
});
for (const id of ['pose', 'inspect-clip']) $(id).addEventListener('input', drawPose);
$('pose-inspector').addEventListener('toggle', () => {
  if ($('pose-inspector').open) stop({ rest: true });
  drawPose();
});
window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop({ rest: true });
  controls();
});
reduced.addEventListener('change', () => {
  follow = false;
  stop({ rest: true });
});
new MutationObserver(() => { draw(); drawPose(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
new ResizeObserver(resize).observe(canvas.parentElement);
if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (!visible) stop({ rest: true });
  else onScroll();
  controls();
}, { threshold: 0 }).observe(canvas.parentElement);

try {
  if (!context || !poseContext) throw new Error('Canvas unavailable');
  const response = await fetch('manifest.json');
  if (!response.ok) throw new Error('Manifest unavailable');
  manifest = await response.json();
  images = Object.fromEntries(await Promise.all(Object.entries(manifest.clips).map(async ([name, clip]) => {
    const image = new Image();
    image.src = clip.file;
    await image.decode();
    return [name, image];
  })));
  ready = true;
  canvas.hidden = false;
  poseCanvas.hidden = false;
  $('fallback').hidden = true;
  resize();
  onScroll();
  controls();
  $('load-state').textContent = 'Current selected · Walk, run, stop, and turn back';
} catch (error) {
  $('load-state').textContent = 'The motion preview could not load. Reload to retry, or inspect the source artwork below.';
  $('load-state').setAttribute('role', 'alert');
  console.error(error);
}
