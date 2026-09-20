import { z } from 'astro/zod';
import profileData from '../data/profile.json';
import homepageData from '../data/homepage.json';
import siteData from '../data/site.json';
import publicationsData from '../data/publications.json';
import newsData from '../data/news.json';

const text = z.string();
const link = z.string().refine(v => !v || /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/.test(v), 'Use https://, mailto:, or a /local/path/.');
const resource = z.object({ label: text, url: link, icon: text.default('external') });
const credential = resource.extend({ detail: text });
function parse<T>(name: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Check src/data/${name}.json:\n${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n')}`);
  return result.data;
}
export const profile = parse('profile', z.object({
  name: text.min(1), firstName: text.min(1), lastName: text, email: z.email(), location: text.default(''),
  description: text, resumeUrl: link.default(''), portrait: link.default(''), portraitAlt: text.default(''),
  now: z.array(credential).default([]), previously: z.array(credential).default([]),
  socials: z.array(resource).default([]), education: z.array(z.object({ degree: text, organization: text, date: text })).default([]),
  service: z.array(text).default([]),
}), profileData);
export const homepage = parse('homepage', z.object({
  highlight: text.default(''), workLimit: z.number().int().nonnegative(), notesLimit: z.number().int().nonnegative(), newsLimit: z.number().int().nonnegative(),
  showNews: z.boolean(), showService: z.boolean(), showAvatar: z.boolean(),
  sections: z.array(z.object({ id: z.enum(['experience','work','publications','writing']), title: text.min(1), navLabel: text, icon: text, order: z.number(), enabled: z.boolean() }))
    .refine(items => new Set(items.map(i => i.id)).size === items.length, 'Section IDs must be unique.'),
}), homepageData);
// Keep all site wording editable while checking every existing field's type.
function shape(value: unknown): z.ZodType {
  if (typeof value === 'string') return z.string();
  if (typeof value === 'boolean') return z.boolean();
  if (Array.isArray(value)) return z.array(z.object({ label: text.min(1), href: link }));
  return z.object(Object.fromEntries(Object.entries(value as object).map(([key, entry]) => [key, shape(entry)])));
}
export const site = parse('site', shape(siteData), siteData) as typeof siteData;
export const publications = parse('publications', z.array(z.object({
  id: text.optional(), title: text.min(1), authors: z.array(text), year: text.regex(/^\d{4}$/), venue: text, paper: link,
})), publicationsData);
export const news = parse('news', z.array(z.object({
  date: text.regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Use YYYY or YYYY-MM.'), text: text.min(1), url: link.default(''),
})), newsData);
