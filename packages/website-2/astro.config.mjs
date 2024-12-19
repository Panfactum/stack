// @ts-check
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import expressiveCode from 'astro-expressive-code'
import { defineConfig } from 'astro/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypeWrap from 'rehype-wrap-all'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

// https://astro.build/config
export default defineConfig({
  cacheDir: '.cache',
  site: process.env.SITE_URL ?? 'http://localhost:3000',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    expressiveCode({}),
    mdx(),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'append' }],
      [
        rehypeWrap,
        { selector: 'table', wrapper: 'div.overflow-x-scroll mb-4' },
      ],
      rehypeKatex,
    ],
    shikiConfig: {
      wrap: false,
    },
  },
})
