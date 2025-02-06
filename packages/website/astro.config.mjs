import mdx from "@astrojs/mdx";
import solidJs from '@astrojs/solid-js';
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeWrap from "rehype-wrap-all";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import compress from "@playform/compress"
import inline from "@playform/inline"
import { imageService } from "@unpic/astro/service";
import { visualizer } from "rollup-plugin-visualizer";

const DEFAULT_SITE_URL = "http://localhost:4321"

// https://astro.build/config
export default defineConfig({
  cacheDir: ".cache",
  site: process.env.SITE_URL ?? DEFAULT_SITE_URL,
  env: {
    schema: {
      ALGOLIA_APP_ID: envField.string({
        context: "client",
        access: "public",
        default: "VJ9GF38NJX"
      }),
      ALGOLIA_SEARCH_API_KEY: envField.string({
        context: "client",
        access: "public",
        default: "76e7c17dae4d35f581c858ee2784b41a" // Don't worry, this is a public key used be the FE to hit the search API
      }),
      ALGOLIA_INDEX_NAME: envField.string({
        context: "client",
        access: "public",
        default: "docs-2"
      }),
      SITE_URL: envField.string({
        context: "client",
        access: "public",
        default: DEFAULT_SITE_URL
      }),
      NODE_ENV: envField.enum({
        context: "client",
        access: "public",
        default: "development",
        values: ["development", "production"]
      })
    }
  },
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
    // inline({
    //   critters: {
    //     preloadFonts: false, // Done by astro-font
    //     keyframes: "none", // Animations not critical
    //     compress: false, // This messes up styles
    //     reduceInlineStyles: false // This messes up styles
    //   }
    // }),
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
  vite: {
    plugins: [visualizer({
      emitFile: true,
      filename: "stats.html"
    })]
  }
});
