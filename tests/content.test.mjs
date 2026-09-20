import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { parse } from 'yaml';

const settings = JSON.parse(readFileSync('src/data/homepage.json', 'utf8'));
const load = file => new JSDOM(readFileSync(`dist/${file}`, 'utf8'), { url: `https://portfolio.test/${file}` });
const compiledHelpers = ts.transpileModule(readFileSync('src/lib/content.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { compareProjects, comparePosts, formatDate, previewLimit } = await import(`data:text/javascript;base64,${Buffer.from(compiledHelpers).toString('base64')}`);
const readEntries = collection => readdirSync(`src/content/${collection}`).filter(file => file.endsWith('.md')).map(file => ({ id: file.replace(/\.md$/, ''), data: parse(readFileSync(`src/content/${collection}/${file}`, 'utf8').split('---')[1]) }));

test('newest entries lead; precision, ties and dates are deterministic', () => {
  const projects = [
    { id: 'older', data: { year: '2024', order: 1 } },
    { id: 'year-only', data: { year: '2026', order: 0 } },
    { id: 'later', data: { year: '2026', date: '2026-09-20', order: 50 } },
    { id: 'earlier', data: { year: '2026', date: '2026-01-01', order: 1 } },
    { id: 'tie', data: { year: '2026', date: '2026-09-20', order: 0 } },
  ];
  assert.deepEqual(projects.sort(compareProjects).slice(0, previewLimit(3)).map(p => p.id), ['tie', 'later', 'earlier']);
  const notes = ['2026-01-01', '2026-09-20', '2025-12-31', '2026-05-01'].map((date, i) => ({ id: String(i), data: { date } }));
  assert.deepEqual(notes.sort(comparePosts).slice(0, 3).map(p => p.id), ['1', '3', '0']);
  assert.equal(formatDate('2026'), '2026');
  assert.equal(formatDate('2026-09'), 'Sep 2026');
  assert.equal(formatDate('2026-09-20'), 'Sep 20, 2026');
  for (const value of [-1, 1.5, NaN]) assert.throws(() => previewLimit(value));
});

test('archives contain every published entry; home previews, menu anchors and footer stay connected', () => {
  const home = load('index.html');
  const doc = home.window.document;
  assert.equal(doc.querySelector('.intro-highlight')?.textContent || '', settings.highlight);
  for (const [collection, route, selector, section, limit, compare] of [
    ['projects', 'projects', '.project h3 a', 'work', settings.workLimit, compareProjects],
    ['posts', 'writing', '.post-list h3 a', 'writing', settings.notesLimit, comparePosts],
  ]) {
    const entries = readEntries(collection);
    const expected = entries.filter(p => p.data.draft === false).sort(compare).map(p => `/${route}/${p.id}/`);
    const archive = load(`${route}/index.html`);
    assert.deepEqual([...archive.window.document.querySelectorAll(selector)].map(a => a.getAttribute('href')), expected);
    const config = settings.sections.find(s => s.id === section);
    const visible = config?.enabled && limit > 0;
    assert.deepEqual([...doc.querySelectorAll(`#${section} ${selector}`)].map(a => a.getAttribute('href')), visible ? expected.slice(0, limit) : []);
    assert.equal(Boolean(doc.querySelector(`.site-header nav a[href="#${section}"]`)), Boolean(visible && config.navLabel));
    for (const draft of entries.filter(p => p.data.draft !== false)) {
      assert.ok(!existsSync(`dist/${route}/${draft.id}/index.html`));
      assert.ok(!archive.window.document.body.textContent.includes(draft.data.title || draft.data.name));
    }
    archive.window.close();
  }
  const site = JSON.parse(readFileSync('src/data/site.json'));
  const profile = JSON.parse(readFileSync('src/data/profile.json'));
  assert.equal(Boolean(doc.querySelector('.footer')), site.showFooter);
  if (site.showFooter) {
    assert.equal(doc.querySelector('.footer p').textContent, site.labels.footer);
    assert.ok(doc.querySelector('.footer small').textContent.endsWith(profile.name));
    assert.equal(doc.querySelector('.back-to-top').getAttribute('href'), '#top');
  }
  home.window.close();
});

test('project and note reading pages preserve image links without JavaScript', () => {
  for (const file of readdirSync('dist', { recursive: true }).filter(f => /^(projects|writing|pages)\/.+\/index.html$/.test(f))) {
    const dom = load(file);
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.ok(doc.querySelector('[data-image-gallery]'));
    assert.ok(doc.querySelector('.image-viewer'));
    assert.ok(!doc.querySelector('.image-viewer').open);
    for (const link of doc.querySelectorAll('[data-image-link]')) {
      assert.equal(link.href, link.querySelector('img').src);
      assert.ok(link.querySelector('img').alt.trim());
    }
    assert.ok(doc.querySelector('.entry-navigation a').href.endsWith(file.startsWith('projects') ? '/projects/' : file.startsWith('writing') ? '/writing/' : '/'));
    dom.window.close();
  }
});

test('CMS fields preserve selectable headers, galleries and draft defaults', () => {
  const cms = parse(readFileSync('.pages.yml', 'utf8'));
  const homepage = cms.content.find(c => c.name === 'homepage');
  assert.equal(homepage.path, 'src/data/homepage.json');
  for (const name of Object.keys(settings)) assert.ok(homepage.fields.some(f => f.name === name));
  for (const collection of ['projects', 'posts']) {
    const fields = cms.content.find(c => c.name === collection).fields;
    for (const name of ['cover', 'coverAlt', 'coverCaption', 'coverWidth', 'coverHeight', 'gallery', 'body']) assert.ok(fields.some(f => f.name === name));
    assert.equal(fields.find(f => f.name === 'draft').default, true);
    assert.equal(fields.find(f => f.name === 'gallery').component, 'gallery-image');
  }
});

test('new-content commands create valid drafts and protect existing files and paths', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'portfolio-content-test-'));
  try {
    mkdirSync(path.join(directory, 'scripts'));
    mkdirSync(path.join(directory, 'templates'));
    copyFileSync('scripts/new-content.mjs', path.join(directory, 'scripts/new-content.mjs'));
    for (const kind of ['note', 'project', 'experience', 'section', 'page']) copyFileSync(`templates/${kind}.md`, path.join(directory, `templates/${kind}.md`));
    const run = (...args) => spawnSync(process.execPath, [path.join(directory, 'scripts/new-content.mjs'), ...args], { encoding: 'utf8', cwd: os.tmpdir() });
    for (const [kind, collection] of [['note', 'posts'], ['project', 'projects'], ['experience', 'experience'], ['section', 'sections'], ['page', 'pages']]) {
      const title = 'A "quoted" title: $HOME and `literal`';
      assert.equal(run(kind, 'example', title).status, 0);
      const file = path.join(directory, `src/content/${collection}/example.md`);
      const content = readFileSync(file, 'utf8');
      const data = parse(content.split('---')[1]);
      assert.equal(data.title || data.name || data.organization, title);
      assert.equal(data.draft, true);
      assert.doesNotMatch(content, /\{\{/);
      assert.equal(run(kind, 'example', 'Overwrite').status, 1);
      assert.equal(readFileSync(file, 'utf8'), content);
    }
    for (const slug of ['../escape', 'Uppercase', 'two--hyphens', 'with spaces', '']) assert.equal(run('note', slug).status, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
