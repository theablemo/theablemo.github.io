import { getCollection, render } from "astro:content";
import { homepage } from './settings';
import { comparePosts, compareProjects } from "./content";

export const previewDrafts = import.meta.env.DEV && import.meta.env.SHOW_DRAFTS === "true";

/** Shared publication rules keep homepage previews and archives in sync. */
export async function getPublishedProjects() {
  return (await getCollection("projects", ({ data }) => (previewDrafts || !data.draft))).sort(
    compareProjects,
  );
}

export async function getPublishedPosts() {
  return (await getCollection("posts", ({ data }) => (previewDrafts || !data.draft))).sort(
    comparePosts,
  );
}

export async function getExperience() {
  const entries = (await getCollection("experience", ({ data }) => previewDrafts || !data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );
  return Promise.all(
    entries.map(async (entry) => ({ ...entry, ...(await render(entry)) })),
  );
}

export async function getPublishedPages() {
  return getCollection('pages', ({ data }) => previewDrafts || !data.draft);
}

export async function getHomeSections() {
  const custom = await getCollection('sections', ({ data }) => previewDrafts || !data.draft);
  const reserved = new Set(['home', 'main', 'top', 'contact', 'news', 'experience', 'work', 'publications', 'writing']);
  for (const entry of custom) {
    if (reserved.has(entry.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`Rename section ${entry.id}: use a unique lowercase filename with hyphens, distinct from built-in section IDs.`);
  }
  const rendered = await Promise.all(custom.map(async entry => ({ id: entry.id, ...entry.data, ...(await render(entry)) })));
  return [...homepage.sections.filter(s => s.enabled && (s.id !== 'work' || homepage.workLimit > 0) && (s.id !== 'writing' || homepage.notesLimit > 0)), ...rendered]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
