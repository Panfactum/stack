#!/usr/bin/env bun
// Proposes groups of changelog entries that share the same change type and
// exact impact component set — candidates for merging via CondenseEntries.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SCRIPT_DIR = import.meta.dir;
const LOG_YAML_PATH = resolve(
  SCRIPT_DIR,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface ChangeEntry {
  id: string;
  type: string;
  summary: string;
  impacts?: Array<{
    type: string;
    component: string;
  }>;
}

interface ChangelogData {
  changes?: ChangeEntry[];
}

function truncate(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return singleLine.slice(0, maxLength - 3) + "...";
}

function componentSignature(entry: ChangeEntry): string {
  if (!entry.impacts || entry.impacts.length === 0) {
    return "(no impacts)";
  }
  const pairs = entry.impacts.map((i) => `${i.type}:${i.component}`);
  const unique = [...new Set(pairs)].sort();
  return unique.join(", ");
}

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("No log.yaml found — nothing to propose.");
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
  if (changes.length === 0) {
    console.log("No changes found in main/log.yaml.");
    return;
  }

  // Group entries by (change.type, componentSignature)
  const groups = new Map<string, { type: string; components: string; entries: ChangeEntry[] }>();

  for (const entry of changes) {
    const changeType = entry.type ?? "unknown";

    // Never group breaking changes or entries without impacts
    if (changeType === "breaking_change") continue;
    const sig = componentSignature(entry);
    if (sig === "(no impacts)") continue;

    const key = `${changeType}||${sig}`;

    let group = groups.get(key);
    if (!group) {
      group = { type: changeType, components: sig, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }

  // Filter to groups with 2+ entries and sort by size descending
  const mergeable = [...groups.values()]
    .filter((g) => g.entries.length >= 2)
    .sort((a, b) => b.entries.length - a.entries.length);

  const coveredEntries = mergeable.reduce((sum, g) => sum + g.entries.length, 0);

  console.log("=== Proposed Groups ===");
  console.log(
    `Found ${mergeable.length} group(s) covering ${coveredEntries} entries (out of ${changes.length} total).`
  );

  if (mergeable.length === 0) {
    return;
  }

  for (let i = 0; i < mergeable.length; i++) {
    const group = mergeable[i];
    console.log("");
    console.log(`--- Group ${i + 1} (${group.entries.length} entries) ---`);
    console.log(`  Type: ${group.type}`);
    console.log(`  Components: ${group.components}`);
    console.log("  Entries:");
    for (const entry of group.entries) {
      const id = entry.id ?? "(no id)";
      const summary = truncate(entry.summary ?? "(no summary)", 80);
      console.log(`    ${id}  ${summary}`);
    }
  }
}

main();
