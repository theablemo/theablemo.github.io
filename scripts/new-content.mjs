import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run from any directory; only writes inside this project's content folders.
const root = fileURLToPath(new URL('../', import.meta.url));
const [kind, slug, ...titleParts] = process.argv.slice(2);
const reserved = ['home', 'main', 'top', 'contact', 'news', 'experience', 'work', 'publications', 'writing'];
if ((kind === 'section' && reserved.includes(slug)) || !['note', 'project', 'experience', 'section', 'page'].includes(kind) || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new:note -- my-note "My note title"\n       npm run new:project -- my-project "My project title"\nAlso supported: npm run new:experience, npm run new:section, npm run new:page (same slug/title arguments).\nUse lowercase letters, numbers, and single hyphens in the slug. Custom sections cannot reuse built-in section IDs.');
  process.exit(1);
}
const title = titleParts.join(' ') || slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const date = new Date().toISOString().slice(0, 10);
const replacements = { title: JSON.stringify(title).slice(1, -1), date, year: date.slice(0, 4) };
const template = await readFile(path.join(root, 'templates', `${kind}.md`), 'utf8');
const content = template.replace(/\{\{(title|date|year)\}\}/g, (_, key) => replacements[key]);
const directory = path.join(root, 'src/content', ({ note: 'posts', project: 'projects', experience: 'experience', section: 'sections', page: 'pages' })[kind]);
const destination = path.join(directory, `${slug}.md`);
await mkdir(directory, { recursive: true });
try {
  await writeFile(destination, content, { flag: 'wx' });
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error(`That ${kind} already exists: ${destination}. Choose another slug or edit the existing file.`);
    process.exit(1);
  }
  throw error;
}
console.log(`Created draft: ${destination}\nEdit the content, use npm run dev:drafts to preview safely. Set draft: false when ready to publish.`);
