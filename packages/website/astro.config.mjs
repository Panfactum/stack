import mdx from "@astrojs/mdx";
import solidJs from '@astrojs/solid-js';
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeWrap from "rehype-wrap-all";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkCollapsible from "./src/lib/plugins/remarkCollapsible.ts";
import compress from "./src/lib/plugins/compress.ts"
import criticalCSS from "astro-critical-css";
import { imageService } from "@unpic/astro/service";
import { visualizer } from "rollup-plugin-visualizer";
import rehypeReplaceStrings from "./src/lib/plugins/rehypeStringReplace.ts";
import rehypeMermaid from "./src/lib/plugins/rehypeMermaid.ts";
import tailwindcss from "@tailwindcss/vite";
import autoprefixer from 'autoprefixer'
import postcssImporter from 'postcss-import';
import rehypeCollapsible from "./src/lib/plugins/rehypeCollapsible.ts";
import remarkNumbered from "./src/lib/plugins/remarkNumbered.ts";
import remarkIcon from "./src/lib/plugins/remarkIcon.ts";
import rehypeNumbered from "./src/lib/plugins/rehypeNumbered.ts";
import rehypeIcon from "./src/lib/plugins/rehypeIcon.ts";
import rehypeCodeGroup from "./src/lib/plugins/codeGroups.ts";
import rehypeFootnotePopover from "./src/lib/plugins/rehypeFootnotePopover.ts";
import remarkTerm from "./src/lib/plugins/remarkTerm.ts";
import rehypeTermPopover from "./src/lib/plugins/rehypeTermPopover.ts";

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
    inlineStylesheets: 'never' // Must remain 'never' — Tailwind's split imports rely on cascade ordering that breaks when Astro auto-inlines
  },
  image: {
    service: imageService({
      placeholder: "blurhash",

    })
  },
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath, remarkDirective, remarkCollapsible, remarkNumbered, remarkIcon, remarkTerm],
    rehypePlugins: [
      rehypeMermaid,
      rehypeReplaceStrings,
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "append" }],
      [
        rehypeWrap,
        { selector: "table", wrapper: "div.overflow-x-scroll mb-4" },
      ],
      rehypeCollapsible,
      rehypeNumbered,
      rehypeIcon,
      rehypeCodeGroup,
      rehypeFootnotePopover,
      rehypeTermPopover,
      rehypeKatex,
    ],
  },
  integrations: [
    solidJs(),
    expressiveCode(),
    mdx(),
    sitemap(),
    // TODO: Re-enable criticalCSS once build performance is acceptable
    // criticalCSS({
    //   dimensions: [
    //     { width: 624, height: 900 },
    //     { width: 765, height: 900 },
    //     { width: 1023, height: 1500 },
    //     { width: 1263, height: 2000 },
    //     { width: 1500, height: 2000 }
    //   ],
    //   strict: false,
    //   inline: {
    //     // The actual default is "swap" which appears to not work will with astro view transitions
    //     // as the stylesheets end up above the inlined styles which breaks styling in some circumstances (the external stylesheets
    //     // should have priority and thus must come AFTER the inlined styles). The "default" strategy adds
    //     // the external stylesheets to the end of the body which ensures they come after the inlined styles regardless of
    //     // the shenanigans that astro does to the <head>
    //     strategy: "default"
    //   }
    // }),
    compress({
      html: {
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        sortClassName: true,
        sortAttributes: true
      }
    })
  ],
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // @kobalte/utils imports mergeRefs from @solid-primitives/refs but
          // never uses it — upstream issue, safe to ignore.
          if (warning.code === "UNUSED_EXTERNAL_IMPORT" && warning.exporter === "@solid-primitives/refs") return;
          warn(warning);
        }
      }
    },
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
