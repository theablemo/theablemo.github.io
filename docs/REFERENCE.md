# Technical reference

Occasional setup and customization details. For everyday editing and publishing, use the [maintenance guide](MAINTAINING.md).

[Hosting setup](#hosting-setup) · [Content options](#change-the-homepage-structure) · [Images and galleries](#images-galleries-and-résumé) · [Pages CMS](#browser-editing-with-pages-cms) · [Optional commands](#optional-file-creation-commands) · [Avatar](#avatar-and-favicon) · [Troubleshooting](#troubleshooting) · [Credits](#asset-credits)

## Hosting setup

The production output is `dist/`. This site uses root-relative links and must be served at a domain root, such as `https://USERNAME.github.io/` or a custom domain. A project subpath such as `/portfolio/` requires additional link and asset changes; setting Astro's `base` alone is not enough.

The configured origin is `https://theablemo.github.io`. The deployment workflow is `.github/workflows/deploy.yml` and publishes `main` after validation.

### Setting up a new hosting destination

1. Review the site content, contact details and linked destinations. The example notes are drafts; keep them that way until replaced with your writing. The generated HTML CV is the default résumé.
2. Create or choose the GitHub repository and hosting destination. Set `site` inside `defineConfig` in `astro.config.mjs` to the real public origin. Keep the existing settings.
3. For **GitHub Pages**, use a `USERNAME.github.io` repository or a custom domain at its root. Copy the supplied workflow:

   ```sh
   mkdir -p .github/workflows
   cp templates/deploy-pages.yml .github/workflows/deploy.yml
   ```

   In the repository, select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The workflow runs validation before deployment. For a custom domain, configure its DNS and the Pages custom-domain setting, then enable HTTPS once available. See the [official Astro Pages instructions](https://docs.astro.build/en/guides/deploy/github/).
4. For a different Git-connected static host, use Node **24**, install command `npm ci`, build command `npm run validate`, and output directory `dist`. Choose `main` as the production branch. No server adapter or secret is required by this static site.
5. Validate and inspect the production preview:

   ```sh
   npm run validate
   npm run preview
   ```

   Open <http://127.0.0.1:4325/> and check the homepage, a project, writing, CV, both themes, phone layout, keyboard navigation, image viewer and avatar motion. Stop preview with Ctrl+C.
6. Review and create the initial commit. Replace `YOUR_REPOSITORY_URL` below with the actual HTTPS repository URL, without a token:

   ```sh
   git status --short
   git add README.md docs .gitignore .pages.yml package.json package-lock.json astro.config.mjs tsconfig.json src public scripts templates tests
   # For GitHub Pages, also stage its workflow:
   git add .github/workflows/deploy.yml
   git diff --cached --stat
   git diff --cached
   git commit -m "Add personal website"
   git remote add origin YOUR_REPOSITORY_URL
   git push -u origin main
   ```

   Skip `git remote add` if the correct remote already exists (`git remote -v`). Use your existing Git authentication; never put credentials in source files or remote URLs.
7. Check the host's deployment log and open the actual public URL. Verify a direct project URL, reload on a nested route, test the CV and theme toggle, and check the favicon. A successful local build is not a completed deployment.

## Change the homepage structure

In `homepage.json`, each built-in `sections` item has:

- `title`: the heading on the page.
- `navLabel`: its header menu text; `""` removes only its menu link.
- `enabled`: `false` removes the section and its header link.
- `order`: lower numbers appear first. Defaults are 10, 20, 30 and 40.
- `icon`: an icon name from `src/data/icons.json`.
- `id`: the permanent section anchor; retain the existing built-in IDs.

Custom sections use the same title/menu/icon/order fields in Markdown frontmatter, plus `draft`. Their filenames become IDs. For example, `order: 25` places a section between Work (20) and Publications (30). Empty `navLabel` omits it from the menu. Reserved IDs such as `home`, `work`, `writing`, `experience`, `publications` and `contact` cannot be reused. Delete or draft a custom section to remove it.

Set `workLimit`, `notesLimit` or `newsLimit` to a nonnegative whole number. **0 hides that preview**. The work and writing archives still contain all published entries. Set `showNews`, `showService` or `showAvatar` to false to hide those features. Clear `highlight` to hide the highlight sentence; clear the introduction file to remove its prose. Remove profile list entries to remove individual credentials or links; clear `location` or `portrait` to hide them.

`site.json` controls the footer and CV links, as well as shared labels. Hiding the footer also disables the avatar because its route and motion control end there. A standalone page does not automatically enter navigation: link it from the introduction, a custom section, a post, or `site.json` → `navigation` (the menu on non-home pages). On the homepage, the menu follows visible sections.

Existing layouts are retained. New text/image sections and reading pages require no component changes. A fundamentally different layout, interactive widget or content type still needs development in `src/components/`, `src/pages/` and `src/styles/`.

## Images, galleries, and résumé

Copy images/PDFs into `public/assets/uploads/`, then reference them as `/assets/uploads/filename.ext`. Use names without spaces. `profile.portrait` selects the portrait; `portraitAlt` describes it. Local JPG/PNG/WebP portraits retain Astro image optimization. `resumeUrl` selects your public PDF; empty uses the generated HTML CV. Review the PDF before adding it: every file in `public/` is deployed.

For projects, `image`/`alt` select the card thumbnail; `cover`/`coverAlt` select the page header. Without a cover, the header uses the thumbnail. Notes and standalone pages use `cover`/`coverAlt`. All can be text-only. Optional `coverCaption`, `coverWidth`, and `coverHeight` provide credit and source dimensions.

```yaml
gallery:
  - src: "/assets/uploads/overview.jpg"
    alt: "Describe what the overview shows."
    caption: "An optional caption or credit."
    width: 1600
    height: 900
```

Gallery order follows the list. Dimensions are optional; use actual sizes. Header, thumbnail and gallery images require descriptions. Inline Markdown images can be added anywhere:

```md
![Describe the figure.](/assets/uploads/figure.jpg "Optional caption or credit")
```

Header, inline and gallery images on reading pages join the image viewer. Images linked to another destination keep their link. Resource links accept `{ label, url, icon }`; common icons include `file`, `github`, `code`, `play`, `database`, `external`, `mail`, `linkedin`, `scholar`, `briefcase`, and `degree`.

Conference artwork matches the part of a venue label before ` · `. Unknown venues render as plain text with an icon; no code change is required for a new publication. To add artwork, add a record to `venues.json`; `style: "custom"` uses the generic layout. `lightImage` is optional.

### Ordering and linked publications

Profile and service lists follow their JSON array order. Publications group by descending year; news sorts newest first; experience uses ascending `order`; notes use descending `date`; projects use descending `date` or `year`, then ascending `order` for ties. A publication's optional `id` associates it with a project filename. A missing, deleted or draft project leaves a standalone publication.

## Browser editing with Pages CMS

Once your repository is on GitHub, follow the [Pages CMS quick start](https://pagescms.org/docs/quick-start/) and select the repository and branch containing `.pages.yml`. The editor exposes profile data, introduction, homepage settings, all content collections, publications, news, shared wording, venue artwork and avatar settings. Uploads use the same `public/assets/uploads/` folder. The avatar outfit/timing file is a JSON editor; normal content uses forms or rich text.

CMS saves commit to the selected branch. If that branch triggers production deployment, edits to already-published content and settings can go live immediately. For review first, work on a separate content branch, pull it locally, preview, and merge when ready. New draft entries remain excluded from production. CMS is an editor, not a running preview server.

CMS field coverage is checked automatically. Confirm a real save on a review branch when connecting Pages CMS for the first time. See [Hosting setup](#hosting-setup) above for first-time connection and the [maintenance guide](MAINTAINING.md#publish-your-changes) for subsequent updates.

## Optional file creation commands

These shortcuts **only create new Markdown files** from `templates/` and fill in the title and date. They do not edit existing content or publish anything. Creating or copying files yourself produces the same result.

```sh
npm run new:note -- my-note "My note title"
npm run new:project -- my-project "My project title"
npm run new:experience -- my-role "Organization name"
npm run new:section -- interests "Other interests"
npm run new:page -- about "More about me"
```

For example, the first command creates `src/content/posts/my-note.md` with `draft: true` in its opening metadata block. The scripts refuse to overwrite an existing file.

## Avatar and favicon

The site has two intentional artwork choices: **Current / Arcade** for the animated companion and **Original Brick, three-quarter view** for the favicon. The README uses a larger PNG rendered from that same favicon artwork.

- `src/data/avatar-settings.json`: active outfit, shirt color, optional lettering, portrait gesture timing and motion settings. Keep `markText` empty for the current plain shirt. New clothing shapes require matching pose artwork, not just a color setting.
- `src/data/avatar-route.json`: each section's `recipe`, `descent` and `gesture`. Recipes are `timeline`, `header`, `perch` and `finish`. Descents are `abseil`, `elevator`, `crawl`, `crawl-front`, `slide` and `parachute`. Gestures are `idle`, `curious` and `wave`. New sections default to `perch`; add their IDs to `scenes` for custom paths and to `.pages.yml` to expose those controls in the CMS.
- `src/data/avatar-clips.json`: frame crops, masks, pivots and hand grips. Edit only when changing the source artwork. Lossless sprite originals live in `public/assets/avatar/`.
- `public/favicon.svg`: self-contained selected favicon. After changing it, run `node scripts/build-favicon.mjs` to regenerate its PNG/ICO fallbacks and the README avatar. If the favicon remains cached, update the version suffix in `src/layouts/Site.astro`.
- `homepage.json` → `showAvatar: false` hides the companion. Hiding the footer also disables its route. The footer motion button saves the visitor's preference; reduced-motion settings suppress automatic travel and gestures.

Hover or focus the portrait to preview gestures. Tap/click/Enter/Space plays a wave and one expression; Escape closes it. The companion follows native scroll and reverses with it. It never intercepts scrolling. Review changes in both themes, with slow and fast scrolling, reversal, expanded experience entries, narrow screens, and reduced motion. Automated geometry tests do not establish appearance or perceived motion.

### Code map

| Location | Responsibility |
| --- | --- |
| `src/pages/`, `src/layouts/`, `src/components/` | Routes, page shells and reusable markup |
| `src/lib/collections.ts`, `content.ts`, `settings.ts` | Draft filtering, ordering, formatting and data validation |
| `src/lib/editable-loader.ts` | Refreshing added/deleted Markdown content |
| `src/scripts/site.ts`, `src/scripts/site/` | Theme, identity docking, roles, legend and navigation focus |
| `src/scripts/avatar/` | Sprite rendering, portrait gestures, route geometry and scroll travel |
| `src/scripts/image-viewer.ts` | Article image viewer |
| `src/styles/` | Site and article styling |
| `templates/`, `scripts/` | New-entry templates, authoring commands and favicon generation |
| `tests/`, `tests/fixtures/` | Output, authoring and interaction regression checks |
| `.pages.yml` | Pages CMS forms and collection fields |

Preserve the stylesheet import order: `base.css`, `home.css`, `reading.css`, `responsive.css`, `avatar.css`, then `content.css` from the site layout. Only deployable files belong under `public/`. README images belong in `docs/images/` and are not deployed. Generated output, dependencies, caches and environment files are ignored by Git.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| A new note is missing | Check `draft`, the preview mode, filename and date. `dev:drafts` is on 4326; normal development is on 4324. |
| Production preview looks old | Run `npm run validate` again; preview serves the last `dist/` build. |
| Port is busy | Read the URL printed by Astro; stop the old dev server with `npm run dev:stop`. |
| New/deleted content does not appear | Confirm the file is in the correct collection; restart development. File watching uses polling. |
| Schema or link error | Fix the exact file/field/path reported. JSON cannot contain trailing commas; local asset paths start `/assets/`. |
| Astro cannot save telemetry settings | Prefix the command with `ASTRO_TELEMETRY_DISABLED=1`. |
| `git pull --ff-only` fails | Commit or stash local work and inspect branch divergence; do not force-push to resolve it blindly. |
| Local build passes but site is unchanged | Check the production branch and host deployment logs, then hard-refresh the public URL. |
| Deep links or images fail on the host | Confirm this site is hosted at the domain root and that the host serves directory `index.html` files. |

## Release verification

Run `npm run validate` before each release. It performs Astro/TypeScript checks, creates production output and runs the regression suite, including isolated content changes, empty collections, draft isolation, asset/link checks and simulated interactions. Browser editing and hosting also need a real connected save/deploy check when first configured.

The September 20, 2026 documentation pass passed all 60 tests and generated eight production pages; both example notes are excluded as drafts. Browser screenshot and rendered desktop/mobile review are pending because the available Chrome launch attempts fail before DevTools starts. Hosting and CMS are not connected in this checkout. The low-contrast thin scrollbar override was removed; native scrollbar appearance now follows the browser and selected color scheme. Article code blocks currently retain a dark syntax theme in both site themes. This status is a release record, not a claim that publication is complete.

## README images

`docs/images/avatar.png` is regenerated by `node scripts/build-favicon.mjs` from the selected favicon. For a site screenshot, open the validated production preview at desktop width, return to the top, wait for fonts and images, then capture the browser viewport. Save a real capture as `docs/images/site-desktop.png` and embed it below the README introduction with `![Homepage preview](docs/images/site-desktop.png)`. Keep it outside `public/` so documentation images are not deployed. Refresh it after significant design changes. A real capture is still pending in this checkout.

## Asset credits

The site's fonts and images are served locally. Keep third-party notices in `public/assets/licenses/` when replacing or redistributing assets. The repository currently has no project-wide reuse license; its public visibility does not declare the personal content or third-party artwork freely reusable.

| Asset | Source / attribution |
| --- | --- |
| Pixel icons | [Pixelarticons](https://github.com/halfmage/pixelarticons), MIT; notice in `public/assets/licenses/Pixelarticons-MIT.txt`. Scholar uses its book icon. |
| Schibsted Grotesk | Google Fonts; SIL Open Font License in `public/assets/licenses/Schibsted-OFL.txt`. |
| Profile photograph | [Mohammad's public GitHub profile image](https://avatars.githubusercontent.com/u/58751322?v=4). |
| Current avatar, expression and movement sheets | Generated artwork selected for this site; source PNGs in `public/assets/avatar/`. Production additions used the approved Current identity as reference; exact retained prompts are below. |
| Brick favicon | Selected original three-quarter Brick artwork, embedded unchanged and cropped inside `public/favicon.svg`; PNG/ICO versions are generated from it. |
| InsightToast figure | [Original project teaser](https://raw.githubusercontent.com/ubixgroup/InsightToast/main/assets/teaser.png). |
| AInsight figure | [Original project interface](https://raw.githubusercontent.com/ubixgroup/AInsight/main/images/complete_page.png). |
| Sample note diagram | Original geometric SVG created for the example note, `public/assets/uploads/sample-note-workflow.svg`. |
| UIST 2026 marks | Shuhong Wang / ACM UIST 2026, [official branding](https://uist.acm.org/2026/branding/), CC BY-ND 4.0; source files unchanged. |
| CUI 2025 mark | [Official conference artwork](https://cui.acm.org/2025/assets/img/masthead-sm.png). |
| CHI 2024 mark | [Official conference artwork](https://chi2024.acm.org/wp-content/uploads/2023/10/cropped-cropped-chi24_favicon-192x192.png). |
| MSR 2024 mark | [Official conference artwork](https://conf.researchr.org/getImage/msr-2024/orig/banner_logo_transparant_wide.png). |

## Avatar artwork source prompts

These are retained for future artwork changes. Existing sprite PNGs are the approved sources; recreating them is unnecessary for routine edits.

<details>
<summary>expressions-extra</summary>

```text
Generated with the built-in image_gen tool on September 20, 2026.
References: public/assets/avatar/current.png and public/assets/avatar/expressions.png.
Original transparent output copied unchanged.

Use case: identity-preserve. Asset type: transparent pixel-art sprite atlas for a personal website avatar.
Reference 1 is the approved Current character; reference 2 is its existing facial-expression atlas. Create ONE additional 2-by-2 atlas with exactly four full-body front-facing poses of this SAME adult man, head to sneakers, one per equal cell, fully separated and centered. Genuine transparent RGBA background, no floor or shadow, no checkerboard, no text or labels. Keep identical proportions, black curly hair, short beard, skin tone, pixel size, white plain short-sleeve T-shirt, black jeans and white sneakers. Same calm standing stance, identical body size and ground line within each cell. Change facial expression only: top-left laughing with both eyes joyfully closed and open smile; top-right pleasantly surprised with raised eyebrows, wide eyes and a small O mouth; bottom-left thoughtful with eyes looking sideways and one raised eyebrow, closed mouth; bottom-right sleepy with both eyelids closed, calm relaxed mouth. Make each expression clearly readable at a 40-pixel face size. Keep the hair silhouette and face registration as consistent as possible. Straight-on view, crisp pixel-art edges, no blur, no accessories, no lettering or branding. Prefer 1024x1024 canvas, each figure safely inset in its cell.
```

</details>

<details>
<summary>expressions</summary>

```text
Generated with the built-in image_gen tool on 2026-09-20.
Reference: public/assets/avatar/current.png (preserved unchanged).
Source output: exec-d2359411-fd61-4b6d-a676-3d8cf9c59b86.png.

Use case: stylized-concept. Asset type: facial expression key poses for the approved Current / Arcade pixel avatar.
Reference image 1 is the EXACT approved character identity, style, hair, beard, proportions and plain white T-shirt. Create a transparent square sprite sheet of FOUR full-body front-facing standing poses in a precise 2 by 2 equal cell grid. Same standing body, pose, scale, hair silhouette, face geometry, clothing and baseline in all four cells. Arms down in all cells. Only eyes, brows and mouth change.
Top left: the reference's neutral relaxed face.
Top right: friendly small smile, eyes warmly engaged, eyebrows relaxed, very subtle teeth highlight.
Bottom left: playful wink with his right eye closed, slight asymmetrical smile; keep the other eye the same size as reference.
Bottom right: curious expression, one eyebrow subtly raised, mouth a small amused smile, no exaggerated surprise.
Keep the adult Current / Arcade proportions: smaller head and longer legs, original voluminous swept dark hair and defined moustache and dark short beard. White T-shirt, black jeans, white sneakers. Use the SAME fine stepped pixel styling and restrained shading as the supplied reference. Do not use the larger head or block limbs of a Lego/brick character.
Every figure must be centered within its cell, fully visible head to feet, occupy about 88% of its cell height, have its feet on the same virtual baseline relative to the cell, and maintain consistent proportions. The face is the only region that changes between the cells. Empty alpha background, no shadows or floor, no grid lines or numbers, no labels, logos, text or extra objects.
```

</details>

<details>
<summary>front-traversal</summary>

```text
Generated with the built-in image_gen tool on 2026-09-20.
Reference: current.png. Output copied unchanged to front-traversal.png.

Use case: identity-preserve
Asset type: transparent production pixel-art sprite atlas for the existing website avatar.
Input image is the ONE approved identity and proportions reference. Keep exactly this man's front-facing face, eye shape, broad short beard, voluminous dark curly swept hair, tan complexion, plain white T-shirt, black slim jeans and white sneakers. Do NOT make a chibi character, do NOT enlarge the head or eyes, do NOT make a younger/different face. Match the restrained hard square pixels and adult proportions of the reference, about 5 heads tall.
Create a transparent RGBA atlas, 2048x1024, 4 equal columns and 2 equal rows, each cell 512x512, all limbs fully within each cell, no text/grid/background/floor/circle/rope/web/shadow.
TOP ROW: four sequential full-body poses stepping toward the viewer over an invisible low sill. ALL FACES FRONT FACING. 1: hands brace beside hips, left knee lifted, right foot tucked behind. 2: left sneaker reaches down and PLANTS outside, right knee still behind sill. 3: weight on planted left sneaker, RIGHT knee lifts over sill, arms balance. 4: right sneaker comes down beside left, both feet planted, torso upright and arms relaxed. Same adult face and head scale, measured leg motion one foot then the other. Body slightly crouched, no torso twist.
BOTTOM ROW: four distinct FRONT-FACING spider wall-crawl poses, seen THROUGH an invisible glass wall, face AND chest looking directly at viewer. Limbs spread outward, palms toward viewer flat against wall, elbows bent and knees deeply bent out to the sides, athletic splayed climbing pose. 1: left hand high, right knee high. 2: left hand planted and right foot pushes, right hand lower. 3: right hand high, left knee high. 4: right hand planted and left foot pushes, left hand lower. Alternate diagonal supports. Adult reference face must remain visible front-on, no rear view, no rope gripping. Same regular civilian outfit, no superhero costume.
Keep head centered on torso, clean silhouette, identical character model in all eight cells. Exact 4x2 grid, generous transparent gutters between sprites.
```

</details>

<details>
<summary>parachute</summary>

```text
Generated with the built-in image_gen tool on 2026-09-20.
Reference: public/assets/avatar/current.png (approved Current / Arcade identity).
Original RGBA output copied unchanged from exec-cfaca989-8ef9-42ef-9593-997c87860272.png.
Actual atlas size: 1254 x 1254; four 627 x 627 cells. Measured crops,
hand grips, shirt regions and ground pivots are in src/data/avatar-clips.json.
The SVG canopy and suspension cords are authored in code, separate from this atlas.

Exact prompt:
Use case: stylized-concept
Asset type: production pixel-character sprite atlas, transparent PNG.
Reference image: the approved Current / Arcade character. Preserve his identity, face, dark wavy hair, short beard, warm skin, plain white short-sleeve T-shirt, black jeans, white sneakers, and the same crisp square-pixel illustration style and body proportions.
Create exactly FOUR full-body parachuting character poses in a precise 2-column by 2-row atlas on a 1024x1024 canvas. Each cell is 512x512; character centered at x=256 or 768 with entire silhouette inside its own cell, generous transparent gutters. Same body scale in all four cells, about 360px from top of hair to lowest sole. FRONT-facing or very slight three-quarter. Friendly focused expression.
Top-left: parachute has caught his weight, both arms raised outward, elbows bent, fists at temple height as if holding suspension toggles, legs dangling loosely with knees slightly bent.
Top-right: stable suspended descent, same raised hands clearly separated from head, feet slightly apart, knees relaxed.
Bottom-left: gentle drift, same raised hands, one relaxed knee slightly forward, torso still upright.
Bottom-right: preparing to touch down, both hands still raised, legs lowering toward a soft feet-first landing.
Do NOT draw the parachute, canopy, ropes, strings, toggles, straps or a harness: those are separately animated in code. Draw only the character in all four cells. No motion lines, text, labels, panel borders, scenery, shadow or ground. True transparent alpha background throughout empty areas, no matte or checkerboard painted into the image. No extra limbs, no branding. Keep his hands, face and shoes crisply readable at tiny website avatar sizes.
```

</details>

<details>
<summary>traversal</summary>

```text
Generated with the built-in image_gen tool on 2026-09-20.
References: current.png (approved identity), walk.png (existing sprite style).
Source: exec-a45daa72-2728-4b7f-9f18-1b4a95fcd46d.png. Copied unchanged.

Use case: stylized-concept
Asset type: production transparent pixel-art animation sprite atlas for an existing website avatar.
Input images: first image is the approved character identity reference; second is the existing walking sprite atlas style reference. Preserve the same man, face, dark swept-up hair, short beard, skin color, plain white T-shirt, black jeans, white sneakers, and crisp pixel-art proportions.
Primary request: create ONE new animation atlas containing exactly TWELVE full-body sprites in a strict grid of FOUR columns by THREE rows. Transparent RGBA background, no visible grid, no labels, no circles, no props, no floor, no ropes, no web, no shadows. Canvas 2048 x 1536; each equal cell is 512 x 512. Center each character in its own cell with at least 40 pixels transparent margin. Same character scale and head size across all cells. Strong readable distinct limb poses, never just rotated copies.
TOP ROW, left to right: four sequential poses stepping OUT over a low circular portrait rim toward the viewer and slightly left (do not draw the rim). Frame 1 crouches with hands bracing beside hips and first knee lifted high. Frame 2 plants first sneaker forward/down while trailing leg still bent behind an imaginary sill. Frame 3 transfers weight onto the first planted leg and lifts the second knee across the sill. Frame 4 plants the second sneaker next to the first, finishing the step outside, hands relaxed for balance. Clearly show one leg after the other crossing the sill.
MIDDLE ROW, left to right: four poses for a controlled feet-first slide down a vertical surface, 3/4 side view. Torso leaning back slightly, both knees bent and sneakers extended down/forward; one palm trailing against the imaginary wall at the left of the body for friction, other arm balances. Frame 1 lowers into slide, frame 2 slides with legs forward, frame 3 compresses knees for braking, frame 4 straightens slightly into landing. Not running and not hanging on a rope.
BOTTOM ROW, left to right: four sequential poses of athletic Spider-Man-like WALL CRAWLING, with normal unchanged civilian outfit and NO superhero costume. Three-quarter BACK view, face partly visible in profile, chest towards an invisible vertical wall, upright head. Low spread crouch with arms and legs splayed, palms flat against wall, strongly bent elbows and knees. Frame 1 left hand reaching high + right knee raised, frame 2 left hand planted + right foot pushes, frame 3 right hand reaching high + left knee raised, frame 4 right hand planted + left foot pushes. Four distinct climbing phases with alternating diagonal support. No rotation, no hanging, no web.
Constraints: consistent identity, restrained pixel shading, clean hard pixel edges, genuine transparent background, full limbs inside cell boundaries, exactly 4 columns and 3 rows, no text or symbols.
```

</details>
