/* eslint-disable */

// Defines Astro content collections for the website, including changelog YAML data and MDX upgrade instructions.

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
  loader: glob({ pattern: "**/log.yaml", base: "src/content/changelog" }),
  schema: z.object({
    summary: z.string(),
    skip: z.boolean().default(false),
    branch: z.string().optional(),
    branched_from: z.string().regex(/^edge\./).optional(),
    upgrade_instructions: z.string().regex(/\.mdx$/).optional(),
    highlights: z.array(z.string()).optional(),
    changes: z.array(z.object({
      type: z.enum(["breaking_change", "fix", "improvement", "addition", "deprecation"]),
      summary: z.string(),
      description: z.string().optional(),
      action_items: z.array(z.string()).optional(),
      references: z.array(z.object({
        type: z.enum(["internal-commit", "external-commit", "commit", "issue-report", "external-docs", "internal-docs"]),
        summary: z.string(),
        link: z.string(),
      })).optional(),
      impacts: z.array(z.object({
        type: z.enum(["iac-module", "cli", "devshell", "configuration"]),
        component: z.string(),
        summary: z.string(),
      })).optional(),
    })).optional(),
  }),
});

const upgradeInstructions = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "src/content/changelog" }),
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

export const collections = { docs, maturityModel, changes, upgradeInstructions, presentations };
