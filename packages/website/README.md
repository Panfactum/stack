# Panfactum Website

## 🚀 Project Structure

You'll see the following folders and files:

- `src/` - A directory containing all of your site's code
  - `pages/` - A directory containing all of your site's pages
  - `components/` - A directory containing all of your site's components
  - `styles/` - A directory containing all of your site's styles
  - `hooks/` - A directory containing all of your site's hooks
  - `layouts/` - A directory containing all of your site's layouts
  - `lib/` - A directory containing all of your site's utility functions
  - `stores/` - A directory containing all of your site's stores
- `public/` - A directory containing all of your site's static assets

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command          | Action                                      |
| :--------------- | :------------------------------------------ |
| `pnpm run dev`   | Starts local dev server at `localhost:4321` |
| `pnpm run build` | Build your production site to `./dist/`     |
