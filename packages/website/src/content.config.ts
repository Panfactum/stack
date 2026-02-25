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

const presentations = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "src/content/presentations",
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    author: z.string().optional(),
    thumbnail: z.string().optional(),
    notes: z.string().optional(),
    slideLayout: z.enum(["default", "center", "two-column", "author"]).default("default"),
    transition: z.string().optional(),
  }),
});

export const collections = { docs, maturityModel, changes, presentations };
