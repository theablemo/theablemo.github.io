import settings from '../../data/avatar-settings.json';
import { gestureAt, gestureLength, gestures, type Gesture } from './core';
import type { AvatarRenderer } from './renderer';

type Preview = 'hover' | 'focus' | 'once' | 'cameo' | 'static';

export function mountPortrait(button: HTMLButtonElement, renderer: AvatarRenderer, animated: () => boolean) {
  const canvas = button.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { refresh() {} };
  ctx.imageSmoothingEnabled = false;
  let hovering = false, focused = false, dismissed = false;
  let visible = true, version = 0, exiting = false;
  let mode: Preview | undefined;
  let timer = 0, started = 0, previous: Gesture | undefined, gesture: Gesture = 'wave';
  let painted = '';
  const usable = () => visible && !document.hidden && !exiting;
  const cancel = () => { window.clearTimeout(timer); timer = 0; };
  const label = () => {
    const explicit = mode === 'once' || mode === 'static';
    button.setAttribute('aria-pressed', String(explicit));
    button.setAttribute('aria-label', (explicit ? button.dataset.photoLabel : button.dataset.avatarLabel) || (explicit ? 'Show photograph' : 'Meet the pixel avatar'));
  };
  const hide = () => {
    cancel(); version++; mode = undefined; painted = '';
    button.dataset.avatar = 'false';
    delete button.dataset.gesture;
    label();
  };
  const draw = async (clip: string, frame: number) => {
    const key = `${clip}:${frame}:${renderer.outfit}`;
    if (key === painted) return true;
    painted = key;
    const token = ++version;
    try {
      const pose = await renderer.pose(clip, frame, true);
      if (token !== version || !usable() || !mode) return false;
      ctx.clearRect(0, 0, 96, 96); ctx.drawImage(pose.canvas, 0, 0);
      button.dataset.avatar = 'true';
      return true;
    } catch {
      if (token === version) { hide(); schedule(); }
      return false;
    }
  };
  const chooseExpression = () => {
    const choices = gestures.filter(item => item !== 'wave' && item !== previous);
    gesture = choices[Math.floor(Math.random() * choices.length)];
    previous = gesture;
    started = performance.now();
    button.dataset.gesture = gesture;
  };
  function schedule() {
    if (mode) return;
    cancel();
    if (!usable() || !animated() || hovering || focused) return;
    const [min, max] = settings.cameoDelayMs;
    timer = window.setTimeout(() => void start('cameo'), min + Math.random() * (max - min));
  }
  function tick() {
    if (!usable() || !animated()) { hide(); return; }
    const elapsed = performance.now() - started;
    if (elapsed >= gestureLength(gesture)) {
      if ((mode === 'once' || mode === 'cameo') && gesture !== 'wave') {
        hide(); schedule(); return;
      }
      chooseExpression();
    }
    const pose = gestureAt(gesture, performance.now() - started);
    void draw(pose.clip, pose.frame);
    timer = window.setTimeout(tick, 85);
  }
  async function start(next: Exclude<Preview, 'static'>) {
    if (!usable() || (!animated() && next !== 'once')) return;
    // A fresh interaction owns the preview, even if it interrupts a cameo.
    hide();
    mode = animated() ? next : 'static';
    gesture = 'wave'; label();
    button.dataset.gesture = mode === 'static' ? 'idle' : gesture;
    const session = version;
    const ready = await draw(mode === 'static' ? 'idle' : 'wave', 0);
    // Draw increments the version. An exit/re-entry must invalidate this start.
    if (!ready || version !== session + 1 || !mode) return;
    if (mode !== 'static') {
      // Asset decoding must not consume the greeting before it becomes visible.
      started = performance.now();
      tick();
    }
  }
  function refresh() {
    const explicit = mode === 'once' || mode === 'static';
    hide();
    if (explicit && usable()) void start('once');
    else if (!dismissed && animated() && (hovering || focused)) void start(hovering ? 'hover' : 'focus');
    else schedule();
  }
  button.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovering = true; dismissed = false;
    void start('hover');
  });
  button.addEventListener('pointerleave', () => {
    if (!hovering) return;
    hovering = false; dismissed = false;
    hide(); schedule();
  });
  button.addEventListener('focus', () => {
    focused = button.matches(':focus-visible');
    if (focused) { dismissed = false; void start('focus'); }
  });
  button.addEventListener('blur', () => {
    focused = false; dismissed = false;
    if (mode === 'focus' || mode === 'once' || mode === 'static') hide();
    schedule();
  });
  button.addEventListener('click', () => {
    if (mode === 'once' || mode === 'static') {
      dismissed = true; hide(); schedule();
    } else { dismissed = false; void start('once'); }
  });
  button.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    dismissed = true; hide(); schedule();
  });
  document.addEventListener('visibilitychange', refresh);
  // Suspend the face while the travel layer owns the visible portrait.
  button.addEventListener('avatar:exit', event => {
    exiting = (event as CustomEvent<boolean>).detail;
    refresh();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      const next = entries[0]?.isIntersecting ?? true;
      if (next !== visible) { visible = next; refresh(); }
    }).observe(button);
  }
  label(); schedule();
  return { refresh };
}
