import type { CollectionEntry } from 'astro:content';

/** Dates stay in UTC so a visitor's timezone cannot change their displayed day. */
export function formatDate(date: string) {
  if (date.length === 4) return date;
  const full = date.length === 7 ? `${date}-01` : date;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    ...(date.length === 10 ? { day: 'numeric' as const } : {}),
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${full}T12:00:00Z`));
}

export function compareProjects(a: CollectionEntry<'projects'>, b: CollectionEntry<'projects'>) {
  return (b.data.date || b.data.year).localeCompare(a.data.date || a.data.year)
    || a.data.order - b.data.order || a.id.localeCompare(b.id);
}

export function comparePosts(a: CollectionEntry<'posts'>, b: CollectionEntry<'posts'>) {
  return b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id);
}

export function previewLimit(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new Error('Homepage limits must be non-negative whole numbers.');
  return value;
}
