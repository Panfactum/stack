// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import remarkGfm from "remark-gfm";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeWrap from "rehype-wrap-all";
import rehypeUrls from "rehype-urls";
import {
  discordServerLink,
  replaceVersionPlaceholders,
} from "./src/lib/constants";

// https://astro.build/config
export default defineConfig({
  // site: "https://panfactum.com",
  site: "http://localhost:3000",
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
      [rehypeAutolinkHeadings, { behavior: "append" }],
      [
        rehypeWrap,
        { selector: "table", wrapper: "div.overflow-x-scroll mb-4" },
      ],
      rehypeKatex,
      [
        rehypeUrls,
        {
          transform: (url) => {
            if (!url.path) {
              return;
            }
            return replaceVersionPlaceholders(url.href).replaceAll(
              "__discordServerLink__",
              discordServerLink,
            );
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
});
