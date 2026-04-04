#!/usr/bin/env bun
// Shows the full content of a single change entry by its UUID.

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SCRIPT_DIR = import.meta.dir;
const LOG_YAML_PATH = resolve(
  SCRIPT_DIR,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface ChangeReference {
  type: string;
  summary: string;
  link: string;
}

interface ChangeImpact {
  type: string;
  component: string;
  summary?: string;
}

interface ChangeEntry {
  id: string;
  type: string;
  summary: string;
  description?: string;
  action_items?: string[];
  references?: ChangeReference[];
  impacts?: ChangeImpact[];
}

interface ChangelogData {
  changes?: ChangeEntry[];
}

function main(): void {
  const targetId = process.argv[2];
  if (!targetId) {
    console.error("Usage: bun ./scripts/show-change.ts <change-id>");
    console.error("  <change-id>  Full or partial UUID of the change entry");
    process.exit(1);
  }

  if (!existsSync(LOG_YAML_PATH)) {
    console.error("Error: log.yaml not found.");
    process.exit(1);
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
  const matches = changes.filter((c) => c.id.startsWith(targetId));

  if (matches.length === 0) {
    console.error(`No change found matching id "${targetId}".`);
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error(`Ambiguous id "${targetId}" — ${matches.length} matches:`);
    for (const match of matches) {
      console.error(`  ${match.id}`);
    }
    console.error("Provide a longer prefix to disambiguate.");
    process.exit(1);
  }

  const change = matches[0]!;
  const index = changes.indexOf(change);

  console.log(`=== Change #${index + 1} ===`);
  console.log("");
  console.log(stringifyYaml(change, { lineWidth: 120 }).trimEnd());
}

main();
