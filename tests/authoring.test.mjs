import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { parse } from 'yaml';

const json = file => JSON.parse(readFileSync(file, 'utf8'));
test('the browser editor exposes every editable data field', () => {
  const cms = parse(readFileSync('.pages.yml', 'utf8'));
  function check(value, fields, location) {
    for (const [key, entry] of Object.entries(value)) {
      const field = fields.find(f => f.name === key);
      assert.ok(field, `${location}.${key} is missing from the editor`);
      if (entry && typeof entry === 'object') {
        const sample = Array.isArray(entry) ? entry[0] : entry;
        if (sample && typeof sample === 'object') check(sample, field.fields || cms.components[field.component]?.fields || [], `${location}.${key}`);
      }
    }
  }
  for (const name of ['profile', 'homepage', 'site', 'venues', 'news', 'publications']) {
    const value = json(`src/data/${name}.json`);
    check(Array.isArray(value) ? value[0] || {} : value, cms.content.find(c => c.name === name).fields, name);
  }
});

test('editing, adding, removing, and emptying content works without changing templates or tests', { timeout: 60000 }, async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'portfolio-authoring-')));
  let server;
  let serverLog = "";
  const writeJSON = (file, value) => writeFileSync(path.join(root, file), JSON.stringify(value));
  const writeEntry = (collection, name, data, body = 'Editable **Markdown** body.') => writeFileSync(path.join(root, `src/content/${collection}/${name}.md`), `---\n${Object.entries(data).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n${body}\n`);
  const run = args => {
    const result = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', SHOW_DRAFTS: 'true' }, encoding: 'utf8', timeout: 25000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const build = () => run(['node_modules/astro/bin/astro.mjs', 'build']);
  const document = file => new JSDOM(readFileSync(path.join(root, `dist/${file}`), 'utf8')).window.document;
  try {
    for (const item of ['src', 'public', 'templates', 'scripts', 'tests', 'package.json', 'astro.config.mjs', 'tsconfig.json', '.pages.yml']) cpSync(item, path.join(root, item), { recursive: true });
    symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
    for (const collection of ['projects','posts','experience','pages','sections']) for (const name of readdirSync(path.join(root, `src/content/${collection}`))) rmSync(path.join(root, `src/content/${collection}`, name), { recursive: true, force: true });
    writeFileSync(path.join(root, 'src/content/introduction.md'), 'A new editable introduction.');
    const profile = json('src/data/profile.json');
    Object.assign(profile, { name: 'Test Author', firstName: 'Test', lastName: 'Author', now: [], previously: [], socials: [], education: [], service: [], resumeUrl: '/assets/uploads/test-resume.pdf', portrait: '' });
    writeJSON('src/data/profile.json', profile);
    writeFileSync(path.join(root, 'public/assets/uploads/test-resume.pdf'), '%PDF-1.4\n% disposable link test\n');
    writeJSON('src/data/publications.json', []); writeJSON('src/data/news.json', []);
    const homepage = json('src/data/homepage.json');
    Object.assign(homepage, { highlight: '', showNews: false, showService: false, showAvatar: false });
    homepage.sections.find(s => s.id === 'experience').enabled = false;
    homepage.sections.find(s => s.id === 'work').title = 'Renamed projects';
    homepage.sections.find(s => s.id === 'writing').order = 15;
    writeJSON('src/data/homepage.json', homepage);
    const site = json('src/data/site.json'); site.labels.footer='Edited footer'; site.navigation.push({label:'Extra page',href:'/pages/example/'}); writeJSON('src/data/site.json', site);
    writeEntry('posts', 'published', {title:'Published test note',description:'A test',date:'2026-09-20',draft:false});
    writeEntry('posts', 'private', {title:'Unpublished test note',description:'A test',date:'2026-09-20',draft:true});
    writeEntry('projects', 'published', {name:'Published test project',tagline:'A test',description:'A test',year:'2026',draft:false});
    writeEntry('projects', 'private', {name:'Unpublished test project',tagline:'A test',description:'A test',year:'2026',draft:true});
    writeEntry('experience', 'private', {organization:'Unpublished test role',role:'Test',date:'2026',kind:'industry',order:0,draft:true});
    for (const draft of [false,true]) {
      writeEntry('pages', draft ? 'private' : 'example', {title: draft ? 'Unpublished test page' : 'Extra test page',description:'A test',draft});
      writeEntry('sections', draft ? 'private' : 'custom', {title: draft ? 'Unpublished test section' : 'Custom test section',navLabel:'Custom',order:5,draft});
    }
    build();
    const home = document('index.html');
    assert.deepEqual([...home.querySelectorAll('main > .section')].map(s=>s.id), ['custom','writing','work','publications']);
    assert.equal(home.querySelector('#work h2').textContent,'Renamed projects');
    assert.equal(home.querySelector('#custom strong').textContent,'Markdown');
    assert.equal(home.querySelector('.footer p').textContent,'Edited footer');
    assert.ok(home.querySelector('a[href="#custom"]'));
    assert.equal(home.querySelector('a[href="#experience"]'),null);
    assert.equal(home.querySelector('.draft-preview'),null, 'SHOW_DRAFTS must never affect production');
    assert.doesNotMatch(home.body.textContent,/Unpublished test/);
    for (const route of ['writing','projects','pages']) assert.ok(!existsSync(path.join(root, `dist/${route}/private/index.html`)));
    assert.doesNotMatch(document('cv/index.html').body.textContent,/Unpublished test role/);
    assert.equal(document('pages/example/index.html').querySelector('h1').textContent,'Extra test page');
    run(['--test','tests/content.test.mjs','tests/site.test.mjs']);
    // Deleting the last item in each collection and removing every section must remain valid.
    for (const collection of ['projects','posts','experience','pages','sections']) for (const name of readdirSync(path.join(root, `src/content/${collection}`))) rmSync(path.join(root, `src/content/${collection}`, name));
    homepage.sections=[];homepage.workLimit=0;homepage.notesLimit=0;homepage.newsLimit=0;writeJSON('src/data/homepage.json',homepage);
    site.showFooter=false;site.navigation=site.navigation.filter(n=>n.href!='/pages/example/');writeJSON('src/data/site.json',site);
    build();
    assert.equal(document('index.html').querySelectorAll('main > .section').length,0);
    assert.equal(document('index.html').querySelector('.footer'),null);
    assert.ok(document('writing/index.html').body.textContent.includes(site.writing.empty));
    run(['--test','tests/content.test.mjs','tests/site.test.mjs']);
    // Live preview must notice the first added file after starting with empty folders.
    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
    const port = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs','dev','--ignore-lock','--host','127.0.0.1','--port',String(port)], {
      cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED:'1', ASTRO_DEV_BACKGROUND:'1', CHOKIDAR_USEPOLLING:'1', SHOW_DRAFTS:'true' }, stdio:['ignore','pipe','pipe'],
    });
    server.stdout.on('data', data => { serverLog += data; });
    server.stderr.on('data', data => { serverLog += data; });
    const waitFor = async (route, predicate) => {
      for (let attempt=0; attempt<60; attempt++) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(1000) });
          if (predicate(response.status, await response.text())) return;
        } catch {}
        await delay(100);
      }
      assert.fail(`Live authoring did not update ${route}\n${serverLog}`);
    };
    await waitFor('/', (status, html) => status === 200 && html.includes('Local draft preview'));
    await delay(600); // Allow initial directory watching to finish before emulating an editor save.
    writeEntry('posts','live-draft',{title:'New live draft',description:'New draft',date:'2026-09-20',draft:true});
    await waitFor('/writing/live-draft/', (status, html) => status === 200 && html.includes('New live draft'));
    rmSync(path.join(root,'src/content/posts/live-draft.md'));
    await waitFor('/writing/live-draft/', status => status === 404);
  } finally {
    if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
    rmSync(root, { recursive: true, force: true });
  }
});
