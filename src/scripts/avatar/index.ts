import { AvatarRenderer } from './renderer';
import { mountPortrait } from './portrait';
import { mountJourney } from './journey';

const portrait = document.querySelector<HTMLButtonElement>('#portrait');
const layer = document.querySelector<HTMLElement>('#avatar-journey');
const toggle = document.querySelector<HTMLButtonElement>('#avatar-motion');
if (portrait && layer && toggle) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  try { enabled = localStorage.getItem('portfolio-avatar-motion') !== 'off'; } catch {}
  const animated = () => enabled && !reduced.matches;
  const renderer = new AvatarRenderer();
  const face = mountPortrait(portrait, renderer, animated);
  const journey = mountJourney(layer, renderer, animated);
  const sync = () => {
    toggle.hidden = false;
    toggle.setAttribute('aria-pressed', String(animated()));
    toggle.textContent = (reduced.matches ? toggle.dataset.reducedLabel : enabled ? toggle.dataset.onLabel : toggle.dataset.offLabel) || 'Avatar motion';
    toggle.setAttribute('aria-disabled', String(reduced.matches));
    toggle.title = (reduced.matches ? toggle.dataset.preferenceLabel : toggle.dataset.toggleLabel) || '';
    face.refresh(); journey.refresh();
  };
  toggle.addEventListener('click', () => {
    if (reduced.matches) return;
    enabled = !enabled;
    try { localStorage.setItem('portfolio-avatar-motion', enabled ? 'on' : 'off'); } catch {}
    sync();
  });
  reduced.addEventListener('change', sync);
  window.addEventListener('storage', event => {
    if (event.key !== 'portfolio-avatar-motion') return;
    enabled = event.newValue !== 'off'; sync();
  });
  // Optional editor/preview hook. Both instances share the same wardrobe.
  window.addEventListener('avatar:outfit', event => {
    const id = (event as CustomEvent<string>).detail;
    if (renderer.setOutfit(id)) { face.refresh(); journey.refresh(); }
  });
  sync();
}
