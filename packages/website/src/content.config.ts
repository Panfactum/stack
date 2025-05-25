/* eslint-disable */

import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "src/content/docs",
  })
});

const maturityModel = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "src/content/maturity",
  })
});

const changes = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "src/content/changelog",
  }),
  schema: z.object({
    summary: z.string(),
    skip: z.boolean().default(false),
  }),
});


export const collections = { docs, maturityModel, changes };
