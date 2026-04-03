#!/usr/bin/env bun
// Lists the fields from main/log.yaml needed to generate the summary and highlights.
// Outputs existing summary/highlights, then each change with type, summary, action_items,
// and impacts. Omits references and descriptions.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const LOG_YAML_PATH = resolve(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface ChangeImpact {
  type: string;
  component: string;
  summary?: string;
}

interface ChangeEntry {
  type: string;
  summary: string;
  action_items?: string[];
  impacts?: ChangeImpact[];
}

interface ChangelogData {
  summary?: string;
  highlights?: string[];
  upgrade_instructions?: string;
  changes?: ChangeEntry[];
}

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("No log.yaml found — nothing to summarize.");
    return;
  }

  let data: ChangelogData;
  try {
    const raw = readFileSync(LOG_YAML_PATH, "utf8");
    data = parseYaml(raw) as ChangelogData;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to parse log.yaml: ${message}`);
    process.exit(1);
  }

  const changes = data.changes ?? [];

  console.log("=== Summary Inputs ===\n");

  // Existing top-level fields
  if (data.summary) {
    console.log(`existing summary: ${data.summary}`);
  } else {
    console.log("existing summary: (none)");
  }

  if (Array.isArray(data.highlights) && data.highlights.length > 0) {
    console.log("existing highlights:");
    for (const h of data.highlights) {
      console.log(`  - ${h}`);
    }
  } else {
    console.log("existing highlights: (none)");
  }

  if (data.upgrade_instructions) {
    console.log(`upgrade_instructions: ${data.upgrade_instructions}`);
  }

  console.log(`\nTotal changes: ${changes.length}\n`);

  if (changes.length === 0) {
    console.log("No changes to summarize.");
    return;
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]!;

    console.log(`--- [${i + 1}] ${change.type} ---`);
    console.log(`summary: ${change.summary.replace(/\s+/g, " ").trim()}`);

    if (Array.isArray(change.action_items) && change.action_items.length > 0) {
      console.log("action_items:");
      for (const action of change.action_items) {
        console.log(`  - ${action}`);
      }
    }

    if (Array.isArray(change.impacts) && change.impacts.length > 0) {
      console.log("impacts:");
      for (const impact of change.impacts) {
        const summary = impact.summary ? ` — ${impact.summary}` : "";
        console.log(`  - [${impact.type}] ${impact.component}${summary}`);
      }
    }

    console.log("");
  }
}

main();
