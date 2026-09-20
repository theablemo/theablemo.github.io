import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

function setup(file = 'gallery.html', { native = true } = {}) {
  const dom = new JSDOM(readFileSync(`tests/fixtures/${file}`, 'utf8'), { url: 'https://portfolio.test/', runScripts: 'outside-only' });
  const w = dom.window;
  const doc = w.document;
  // jsdom has no modal implementation; this simulates the native open/close API.
  // Browser focus containment, Escape and rendering still need browser review.
  if (native) {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  }
  w.eval(ts.transpileModule(readFileSync('src/scripts/image-viewer.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText);
  return { dom, w, doc, dialog: doc.querySelector('dialog'), links: [...doc.querySelectorAll('[aria-haspopup="dialog"]')] };
}

test('viewer opens the chosen image, wraps in both directions and restores focus and scrolling', () => {
  const { dom, doc, w, dialog, links } = setup();
  assert.equal(links.length, 3, 'header, inline image and gallery image must all participate');
  doc.documentElement.style.overflow = 'auto';
  links[1].click();
  assert.equal(dialog.open, true);
  assert.equal(doc.querySelector('.viewer-image').src, links[1].href);
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 2 of 3');
  assert.match(doc.querySelector('.viewer-caption').textContent, /InsightToast/);
  assert.equal(doc.activeElement, doc.querySelector('.viewer-close'));
  assert.equal(doc.documentElement.style.overflow, 'hidden');
  doc.querySelector('.viewer-next').click();
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 3 of 3');
  dialog.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 1 of 3');
  dialog.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(doc.querySelector('.viewer-original').href, links[2].href);
  doc.querySelector('.viewer-close').click();
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, links[1]);
  assert.equal(doc.documentElement.style.overflow, 'auto');
  dom.window.close();
});

test('swipe, loading failure recovery and backdrop dismissal work without page navigation', () => {
  const { dom, doc, w, dialog, links } = setup();
  links[0].click();
  const stage = doc.querySelector('.viewer-stage');
  const touch = (type, touches, changedTouches = []) => {
    const event = new w.Event(type, { bubbles: true });
    Object.assign(event, { touches, changedTouches });
    stage.dispatchEvent(event);
  };
  touch('touchstart', [{ clientX: 200, clientY: 100 }]);
  touch('touchend', [], [{ clientX: 80, clientY: 105 }]);
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 2 of 3');
  touch('touchstart', [{ clientX: 80, clientY: 100 }]);
  touch('touchend', [], [{ clientX: 200, clientY: 105 }]);
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 1 of 3');
  touch('touchstart', [{ clientX: 100, clientY: 100 }]);
  touch('touchend', [], [{ clientX: 120, clientY: 250 }]);
  assert.equal(doc.querySelector('.viewer-count').textContent, 'Image 1 of 3', 'vertical gestures do not change the image');
  const image = doc.querySelector('.viewer-image');
  image.dispatchEvent(new w.Event('error'));
  assert.equal(doc.querySelector('.viewer-error').hidden, false);
  assert.equal(image.hidden, true);
  doc.querySelector('.viewer-next').click();
  image.dispatchEvent(new w.Event('load'));
  assert.equal(doc.querySelector('.viewer-error').hidden, true);
  assert.equal(image.hidden, false);
  stage.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  dialog.click();
  assert.equal(dialog.open, true, 'dragging from an image onto the backdrop does not dismiss');
  dialog.dispatchEvent(new w.Event('pointerdown'));
  dialog.click();
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, links[0]);
  dom.window.close();
});

test('single-image projects hide navigation; modifier clicks and unsupported dialogs retain image links', () => {
  const single = setup('project.html');
  single.links[0].dispatchEvent(new single.w.MouseEvent('click', { ctrlKey: true, cancelable: true, bubbles: true }));
  assert.equal(single.dialog.open, false);
  single.links[0].click();
  assert.equal(single.doc.querySelector('.viewer-next').hidden, true);
  assert.equal(single.doc.querySelector('.viewer-previous').hidden, true);
  assert.equal(single.doc.querySelector('.viewer-help').hidden, true);
  single.dom.window.close();
  const plain = setup(undefined, { native: false });
  assert.equal(plain.links.length, 0);
  assert.ok(plain.doc.querySelector('[data-image-link][href]'));
  assert.equal(plain.doc.querySelector('.body-copy img').parentElement.tagName, 'P');
  plain.dom.window.close();
});
