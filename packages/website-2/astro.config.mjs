import mdx from "@astrojs/mdx";
import solidJs from '@astrojs/solid-js';
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import expressiveCode from "astro-expressive-code";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeWrap from "rehype-wrap-all";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import compress from "@playform/compress"
import { imageService } from "@unpic/astro/service";

// https://astro.build/config
export default defineConfig({
  cacheDir: ".cache",
  site: process.env.SITE_URL ?? "http://localhost:3000",
  prefetch: {
    defaultStrategy: 'hover'
  },
  image: {
    service: imageService({
      placeholder: "blurhash",

    })
  },
  integrations: [
    solidJs(),
    tailwind({ applyBaseStyles: false }),
    expressiveCode({
      shiki: {
        bundledLangs: [
            'shellsession',
            'nix',
            'hcl',
            'yaml',
            'dockerfile',
            'dotenv'
        ]
      }
    }),
    mdx(),
    sitemap(),
    compress({
      HTML: {
        "html-minifier-terser": {
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          sortClassName: true,
          sortAttributes: true
        }
      },
      Image: false
    })
  ],
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "append" }],
      [
        rehypeWrap,
        { selector: "table", wrapper: "div.overflow-x-scroll mb-4" },
      ],
      rehypeKatex,
    ],
    shikiConfig: {
      wrap: false,
    },
  },
  experimental: {
    svg: {
      mode: 'sprite'
    }
  },
});
