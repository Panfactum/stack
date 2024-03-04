# Panfactum Website

This contains the source code for the Panfactum website found at [panfactum.com](https://panfactum.com).

## Getting Started

1. First make sure you have read the 
[contributing guide](https://panfactum.com/docs/guides/contributing) and following the instructions
for setting up your developer environment.

2. Install node modules via `npm install`:

3. Run the development server via `npx next dev`

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Architecture and Layout

The project is primarily written in Typescript.

This is a standard [Next.js](https://nextjs.org/) project using the App Router.

The key directories are

- `public`: Static files such as images or file downloads
- `src/app`: The routes for the Next.js app
- `src/components`: Reusable React components
- `src/lib`: Reusable non-UI TS/JS utilities including API clients

### Styling

Styling is done as a mix between out-of-the-box 
[Material UI](https://mui.com/material-ui/getting-started/) components and
custom components built with [TailwindCSS](https://tailwindcss.com/).

We do have some global styles set [here](src/app/globals.css). Most important
are the code block styles for which we use [Prism.js](https://prismjs.com/).

Additionally, we have theme-level variables set in [theme.js](./theme.js) which controls
coloring, breakpoints, etc.

Fonts are configured in [font.ts](./src/app/font.ts).

Other than that, styles are done on a component-level basis
and we do occasionally use the [Styled Components pattern](https://emotion.sh/docs/styled). 

### Markdown Docs

We do enable `mdx` files to be used in the site via 
[@next/mdx](https://nextjs.org/docs/app/building-your-application/configuring/mdx).
We provide custom elements via [mdx-components.tsx](src/mdx-components.tsx).

When adding new Markdown documentation, you MUST ensure that you manually
adjust the various layouts to include links to the new pages. This is NOT automatically
generated as in some other frameworks like [docusaurus](https://docusaurus.io/).