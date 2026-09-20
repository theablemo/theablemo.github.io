import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { editableGlob as glob } from "./lib/editable-loader";

const resource = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string().default("external"),
});
const date = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date in YYYY-MM-DD format.');
const galleryImage = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
const media = {
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  coverCaption: z.string().default(''),
  coverWidth: z.number().int().positive().optional(),
  coverHeight: z.number().int().positive().optional(),
  gallery: z.array(galleryImage).default([]),
};
function validateMedia(data: { cover?: string; coverAlt?: string; image?: string; alt?: string }, ctx: z.RefinementCtx) {
  if (data.cover && !data.coverAlt?.trim()) ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'Describe the header image in coverAlt.' });
  if (data.image && !data.alt?.trim()) ctx.addIssue({ code: 'custom', path: ['alt'], message: 'Describe the card image in alt.' });
}
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    name: z.string(),
    order: z.number().default(0),
    year: z.string().regex(/^\d{4}$/, 'Use a four-digit year.'),
    date: date.optional().or(z.literal('')).transform(value => value || undefined),
    venue: z.string().default(''),
    tagline: z.string(),
    description: z.string(),
    image: z.string().optional(),
    alt: z.string().optional(),
    resources: z.array(resource).default([]),
    draft: z.boolean().default(true),
    ...media,
  }).superRefine(validateMedia),
});
const experience = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/experience" }),
  schema: z.object({
    draft: z.boolean().default(false),
    order: z.number(),
    organization: z.string(),
    organizationUrl: z.string().default(""),
    logo: z.string().optional(),
    role: z.string(),
    date: z.string(),
    kind: z.enum(["industry", "academia"]),
    highlights: z.array(resource).default([]),
  }),
});
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date,
    draft: z.boolean().default(true),
    sample: z.boolean().default(false),
    ...media,
  }).superRefine(validateMedia),
});
const sections = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/sections" }),
  schema: z.object({ title: z.string().min(1), navLabel: z.string().default(''), icon: z.string().default('file'), order: z.number().default(50), draft: z.boolean().default(true) }),
});
const pages = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/pages" }),
  schema: z.object({ title: z.string().min(1), description: z.string().default(''), draft: z.boolean().default(true), ...media }).superRefine(validateMedia),
});
export const collections = { projects, experience, posts, sections, pages };
