/* eslint-disable */

import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "src/content/docs",
  })
});

export const collections = { docs };
