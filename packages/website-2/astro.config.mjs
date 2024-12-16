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
import rehypeUrls from 'rehype-urls'
import rehypeWrap from 'rehype-wrap-all'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  discordServerLink,
  replaceVersionPlaceholders,
} from './src/lib/constants'

// https://astro.build/config
export default defineConfig({
  // site: "https://panfactum.com",
  site: 'http://localhost:3000',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    expressiveCode(),
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
      [
        rehypeUrls,
        {
          transform: (url) => {
            if (!url.path) {
              return
            }
            return replaceVersionPlaceholders(url.href).replaceAll(
              '__discordServerLink__',
              discordServerLink,
            )
          },
        },
      ],
    ],
    shikiConfig: {
      wrap: false,
    },
  },

  redirects: {
    /*"/docs/framework": {
      status: 302,
      destination: "/docs/framework/framework/overview",
    },*/
  },
})
