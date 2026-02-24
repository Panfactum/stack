# Panfactum Website

This package contains the source code for the [Panfactum website](https://panfactum.com).

# Commands

All commands are run from the root of the project, from a terminal:

| Command          | Action                                      |
| :--------------- | :------------------------------------------ |
| `pnpm dev`   | Starts local dev server at `localhost:4321` |
| `pnpm build` | Build your production site to `./dist/`     |
| `pnpm check` | Check for type errors    |
| `pnpm lint` | Perform linting with autofix enabled  |

# General Architecture

This is an [Astro](https://astro.build/) site that uses [SolidJS](https://www.solidjs.com/) for interactive components.

The site contains several one-off pages for marketing and public outreach. However, the majority of the site content is contained
in Markdown files under `/src/content` which contains documentation, blog articles, and other Panfactum-related information. 

In particular, we use an enhanced Markdown syntax (MDX) for which you can find general information [here](https://docs.astro.build/en/guides/markdown-content/). We have enhanced the basic Markdown build pipeline with many plugins, including several custom ones.

All code is written in Typescript and uses `pnpm` as the package manager. We aim to enable the strictest possible type-checking and linting whenever possible.

## Project Structure

See [TOC.md](TOC.md) for a description of this package's contents and [src/TOC.md](src/TOC.md) for the source code layout.

## Key Dependencies

Besides Astro and SolidJS, take note of the following key dependencies:

- [Tailwind v4](https://tailwindcss.com/) - The vast majority of the styling is doing via Tailwind classes
- [Kobalte](https://kobalte.dev/docs/core/overview/introduction/) - Component library for SolidJS
- [Solid Primitives](https://primitives.solidjs.community/) - Helper utilities for SolidJS
- [Solid Icons](https://solid-icons.vercel.app/) - Collection of icons that can be used inside SolidJS components
- [Nanostores](https://github.com/nanostores/solid) - Used to manage state between Astro islands
- [Zod](https://zod.dev/) - Data validation at I/O boundaries
- [Unpic](https://unpic.pics/) - Image optimization
- [clsx](https://www.npmjs.com/package/clsx) - Utility for constructing class name strings based on complex logic


# Contributing

Be sure to review and follow the guidelines documented in our [STYLEGUIDE](./STYLEGUIDE.md) when
making contributions.




