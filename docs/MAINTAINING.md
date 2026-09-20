# Edit, preview, and publish

Edit the site's files directly in your editor. You do not need commands to create or change content. The commands below run the local preview and publish your changes.

## Start the local preview

Open a terminal in the project folder. With Node.js 22.12 or newer installed, run `npm ci` once to install the dependencies. Then start the site:

```sh
npm run dev
```

Open **http://127.0.0.1:4324/**. Save a file and the preview updates. If Astro prints a different address, use that one. Stop the preview with Ctrl+C, or `npm run dev:stop` if it runs in the background.

## Edit existing content

Open the relevant file, change its contents, and save:

| What to change | Where to edit |
| --- | --- |
| Bio, contact links, education, portrait, résumé link | `src/data/profile.json` |
| Introduction text | `src/content/introduction.md` |
| Homepage headings, section order, visibility, highlight | `src/data/homepage.json` |
| Projects | A file in `src/content/projects/` |
| Notes / writing | A file in `src/content/posts/` |
| Experience | A file in `src/content/experience/` |
| Publications or news | `src/data/publications.json` or `src/data/news.json` |
| Navigation, footer, shared labels | `src/data/site.json` |

In JSON files, edit the existing values. To add a publication or news item, copy one complete item in that list and replace its values. Keep commas between items, with no comma after the last item.

## Add a note, project, or other page

Create a `.md` file directly, or copy the matching template into the content folder and rename it:

| Add | Copy this template | Into this folder |
| --- | --- | --- |
| Note | `templates/note.md` | `src/content/posts/` |
| Project | `templates/project.md` | `src/content/projects/` |
| Experience | `templates/experience.md` | `src/content/experience/` |
| Homepage section | `templates/section.md` | `src/content/sections/` |
| Standalone page | `templates/page.md` | `src/content/pages/` |

Use a name such as `my-note.md`. Replace template placeholders such as `{{title}}`, `{{date}}`, and `{{year}}` with your own values. Write the page text below the second `---` line.

For example, this is a complete `src/content/posts/my-note.md` file:

```md
---
title: "My note"
description: "A short summary of this note."
date: "2026-09-20"
draft: true
---

Write the note here. You can use **bold text**, links, lists, and headings.
```

The lines between `---` markers are the page's settings. **`draft` is a line inside this same file:**

- `draft: true` keeps the entry off the published site.
- `draft: false` includes it in the next published build.

Changing this line does **not** upload anything; publishing is a separate step below. These settings also work in projects, experience, custom sections, and standalone pages. If an existing entry has no `draft` line, add it inside its opening `---` block.

To delete an entry, delete its file and remove any links pointing to it. Avoid renaming files that are already published: the filename determines the page's URL. A new standalone page needs a link from your introduction, navigation, or another page so visitors can find it.

## Preview a draft

The usual `npm run dev` preview hides entries marked `draft: true`. **You only need the draft preview if you want to see those entries before marking them ready.** Stop the current preview, then run:

```sh
npm run dev:drafts
```

Open **http://127.0.0.1:4326/**. `dev:drafts` is simply the name of this project's “show drafts too” command. The `:drafts` part is not a general npm option, and you do not need it for ordinary edits to visible content.

To return to the usual preview, stop this one and run `npm run dev` again. Draft files are still visible in a public repository; `draft` only controls whether they appear on the website.

## Add an image or update the résumé

Put images in `public/assets/uploads/`. In a Markdown page, refer to them without the `public` part:

```md
![Describe the image.](/assets/uploads/my-image.jpg)
```

For a résumé PDF, put the reviewed file in the same folder and set `resumeUrl` in `src/data/profile.json` to `/assets/uploads/my-resume.pdf`. Leave `resumeUrl` empty to use the generated CV. Every file in `public/` is deployed, even if only a draft uses it.

## Publish your changes

The site is hosted at **https://theablemo.github.io/** from [theablemo/theablemo.github.io](https://github.com/theablemo/theablemo.github.io). Pushing to `main` runs the validation and deployment workflow in `.github/workflows/deploy.yml`.

1. Set `draft: false` in any entry you want to publish.
2. Check the site and build the publishable version:

   ```sh
   npm run validate
   npm run preview
   ```

   Open **http://127.0.0.1:4325/** and inspect your changes, including at phone width. This preview hides drafts and shows the last build. After further edits, run `npm run validate` again to refresh it. Fix any reported errors before continuing.
3. Commit the files you changed and push them to the connected publishing branch. You can do this in your editor's Git panel. For example, to publish the note above from the terminal:

   ```sh
   git add src/content/posts/my-note.md
   git diff --cached
   git commit -m "Publish my note"
   git push
   ```

   Include any new images or other edited files in the commit too.
4. Check that the host's deployment succeeded, then open the public page to confirm the update.

If you also edit through another computer or Pages CMS, pull those changes before starting local edits. To correct something, edit and publish again. To undo a whole commit, use `git revert COMMIT_ID`, validate, and push.

For occasional setup, galleries, avatar settings, troubleshooting, and asset credits, see the [technical reference](REFERENCE.md).
