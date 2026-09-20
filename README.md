<p align="center">
  <img src="docs/images/avatar.png" width="88" height="88" alt="Mohammad’s Brick avatar" />
</p>

# Mohammad Abolnejadian · Personal website

A custom portfolio template built for my work in applied AI, human–computer interaction, and information visualization. Designed and implemented with Astro and TypeScript, with editable Markdown and JSON content.

## Features

- Projects, publications, experience, writing, and a printable CV.
- Responsive layouts, light and dark themes, and a pixel-art scroll companion with reduced-motion support.
- Local draft previews and optional browser editing through Pages CMS.
- Static output, locally hosted fonts and images, and automated content and interaction checks.

## Run locally

Use Node.js **22.12 or newer** (Node 24 is used for deployment).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4324/**. To validate and preview the production build:

```sh
npm run validate
npm run preview
```

Production preview runs at **http://127.0.0.1:4325/**.

## Maintain the site

The [maintenance guide](docs/MAINTAINING.md) covers everyday editing, adding content, previewing, and publishing. Optional setup and technical details live in the [technical reference](docs/REFERENCE.md).

Content lives in `src/content/` and `src/data/`; uploaded media lives in `public/assets/uploads/`. Hosting publishes the generated `dist/` directory.

## Credits

Built with [Astro](https://astro.build/), [Schibsted Grotesk](https://fonts.google.com/specimen/Schibsted+Grotesk), and [Pixelarticons](https://github.com/halfmage/pixelarticons). Artwork sources and third-party notices are recorded in the [technical reference](docs/REFERENCE.md#asset-credits).
