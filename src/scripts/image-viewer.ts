// Progressive enhancement: figures link to their originals without JavaScript.
// A native modal dialog owns focus containment and Escape dismissal.
const viewer = document.querySelector<HTMLDialogElement>('.image-viewer');
const gallery = document.querySelector<HTMLElement>('[data-image-gallery]');
if (viewer && gallery && typeof viewer.showModal === 'function') {
  const display = viewer.querySelector<HTMLImageElement>('.viewer-image')!;
  const caption = viewer.querySelector<HTMLElement>('.viewer-caption')!;
  const count = viewer.querySelector<HTMLElement>('.viewer-count')!;
  const original = viewer.querySelector<HTMLAnchorElement>('.viewer-original')!;
  const close = viewer.querySelector<HTMLButtonElement>('.viewer-close')!;
  const previous = viewer.querySelector<HTMLButtonElement>('.viewer-previous')!;
  const next = viewer.querySelector<HTMLButtonElement>('.viewer-next')!;
  const help = viewer.querySelector<HTMLElement>('.viewer-help')!;
  const error = viewer.querySelector<HTMLElement>('.viewer-error')!;
  const stage = viewer.querySelector<HTMLElement>('.viewer-stage')!;
  const images: { src: string; alt: string; caption: string }[] = [];
  const indices = new Map<string, number>();
  let current = 0;
  let trigger: HTMLElement | null = null;
  let scrollOverflow = '';

  const show = (index: number) => {
    current = (index + images.length) % images.length;
    const image = images[current];
    error.hidden = true;
    display.hidden = false;
    display.alt = image.alt;
    display.src = image.src;
    original.href = image.src;
    caption.textContent = image.caption || image.alt;
    count.textContent = (viewer.dataset.countLabel || 'Image {current} of {total}').replace('{current}', String(current + 1)).replace('{total}', String(images.length));
    previous.hidden = next.hidden = help.hidden = images.length < 2;
  };

  for (const img of gallery.querySelectorAll<HTMLImageElement>('.reading-figure img, .body-copy img')) {
    // Preserve author-supplied links (for example a diagram linking to a paper).
    const existingLink = img.closest<HTMLAnchorElement>('a');
    if (existingLink && !existingLink.hasAttribute('data-image-link')) continue;
    const src = existingLink?.href || img.currentSrc || img.src;
    let index = indices.get(src);
    if (index === undefined) {
      index = images.length;
      indices.set(src, index);
      images.push({ src, alt: img.alt, caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || img.title });
    }
    const link = existingLink || document.createElement('a');
    if (!existingLink) {
      link.href = src;
      link.className = 'image-link inline-image-link';
      link.setAttribute('aria-label', `${viewer.dataset.expandLabel || 'Expand image'}: ${img.alt || viewer.dataset.fallbackAlt || 'Article image'}`);
      img.before(link);
      link.append(img);
    }
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      trigger = link;
      show(index!);
      scrollOverflow = document.documentElement.style.overflow;
      viewer.showModal();
      document.documentElement.style.overflow = 'hidden';
      close.focus();
    });
  }

  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  close.addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    document.documentElement.style.overflow = scrollOverflow;
    trigger?.focus({ preventScroll: true });
  });
  viewer.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  // Only close for a click that both starts and ends on the backdrop.
  let backdrop = false;
  viewer.addEventListener('pointerdown', (event) => { backdrop = event.target === viewer; });
  viewer.addEventListener('click', (event) => {
    if (backdrop && event.target === viewer) viewer.close();
    backdrop = false;
  });
  let touch: { x: number; y: number } | undefined;
  stage.addEventListener('touchstart', (event) => {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : undefined;
  }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (!touch || event.changedTouches.length !== 1 || event.touches.length) { touch = undefined; return; }
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    touch = undefined;
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touch = undefined; }, { passive: true });
  display.addEventListener('error', () => { display.hidden = true; error.hidden = false; });
  display.addEventListener('load', () => { display.hidden = false; error.hidden = true; });
}
