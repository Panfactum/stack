import mdx from "@astrojs/mdx";
import solidJs from '@astrojs/solid-js';
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeWrap from "rehype-wrap-all";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import compress from "@playform/compress"
import criticalCSS from "astro-critical-css";
import { imageService } from "@unpic/astro/service";
import { visualizer } from "rollup-plugin-visualizer";
import rehypeReplaceStrings from "./src/lib/plugins/rehypeStringReplace.ts";
import rehypeMermaid from "./src/lib/plugins/rehypeMermaid.ts";
import tailwindcss from "@tailwindcss/vite";
import autoprefixer from 'autoprefixer'
import postcssImporter from 'postcss-import';
import rehypeCodeGroup from "./src/lib/plugins/codeGroups.ts";

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
  build: {
    inlineStylesheets: 'never' // We use the criticalcss plugin for this
  },
  image: {
    service: imageService({
      placeholder: "blurhash",

    })
  },
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      [rehypeMermaid, {
        // Mermaid renders SVGs at build time in Node.js, so CSS var()
        // references cannot be used here. Values must be hex literals
        // that match the Tailwind @theme tokens in global.css.
        mermaidConfig: {
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#0c111d",         // gray-dark-mode-950
            primaryColor: "#1a3b50",       // brand-750
            primaryTextColor: "#f5f5f6",   // gray-dark-mode-50
            primaryBorderColor: "#333741", // gray-dark-mode-700
            secondaryColor: "#1f242f",     // gray-dark-mode-800
            secondaryTextColor: "#cecfd2", // gray-dark-mode-300
            lineColor: "#70bfeb",          // brand-300
            textColor: "#f5f5f6",          // gray-dark-mode-50
            mainBkg: "#1a3b50",            // brand-750
            nodeBorder: "#333741",         // gray-dark-mode-700
            clusterBkg: "#161b26",         // gray-dark-mode-900
            clusterBorder: "#333741",      // gray-dark-mode-700
            titleColor: "#f5f5f6",         // gray-dark-mode-50
            edgeLabelBackground: "#1f242f", // gray-dark-mode-800
          },
        },
      }],
      rehypeReplaceStrings,
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "append" }],
      [
        rehypeWrap,
        { selector: "table", wrapper: "div.overflow-x-scroll mb-4" },
      ],
      rehypeCodeGroup,
      rehypeKatex,
    ],
  },
  integrations: [
    solidJs(),
    expressiveCode(),
    mdx(),
    sitemap(),
    criticalCSS({
      dimensions: [
        { width: 624, height: 900 },
        { width: 765, height: 900 },
        { width: 1023, height: 1500 },
        { width: 1263, height: 2000 },
        { width: 1500, height: 2000 }
      ],
      strict: false,
      inline: {
        // The actual default is "swap" which appears to not work will with astro view transitions
        // as the stylesheets end up above the inlined styles which breaks styling in some circumstances (the external stylesheets
        // should have priority and thus must come AFTER the inlined styles). The "default" strategy adds
        // the external stylesheets to the end of the body which ensures they come after the inlined styles regardless of
        // the shenanigans that astro does to the <head>
        strategy: "default"
      }
    }),
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
      Image: false // Image compression is tackled by the image service
    })
  ],
  experimental: {
    svg: true
  },
  vite: {
    ssr: {
      // Externalize isomorphic-mermaid and its transitive deps (jsdom, svgdom,
      // etc.) so Vite delegates them to native Node.js imports. Without this,
      // Vite's SSR transform hits a CJS/ESM incompatibility in jsdom's dep
      // chain (html-encoding-sniffer requiring an ESM-only package).
      external: ["isomorphic-mermaid"],
    },
    plugins: [visualizer({
      emitFile: true,
      filename: "stats.html"
    })],
    css: {
      // For some reason, both this AND the postcss.config.cjs file are required. No idea why.
      // Be sure to keep them in sync.
      plugins: [
        postcssImporter(),
        tailwindcss(),
        autoprefixer(),
      ]
    }
  }
});
