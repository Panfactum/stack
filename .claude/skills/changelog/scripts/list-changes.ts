#!/usr/bin/env bun
// Lists current changelog entries in main/log.yaml with counts by type.
// Outputs a human-readable summary of all changes and their types.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SCRIPT_DIR = import.meta.dir;
const LOG_YAML_PATH = resolve(
  SCRIPT_DIR,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface ChangeEntry {
  type: string;
  summary: string;
  description?: string;
  action_items?: string[];
  impacts?: Array<{
    type: string;
    component: string;
    summary: string;
  }>;
  references?: Array<{
    type: string;
    summary: string;
    link?: string;
  }>;
}

interface ChangelogData {
  summary?: string;
  upgrade_instructions?: string;
  highlights?: string[];
  changes?: ChangeEntry[];
}

function truncate(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return singleLine.slice(0, maxLength - 3) + "...";
}

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("=== Changelog Summary (main) ===");
    console.log("No log.yaml found — changelog has not been created yet.");
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
    console.log("=== Changelog Summary (main) ===");
    console.log("No changes found in main/log.yaml.");
    return;
  }

  const countsByType: Record<string, number> = {};
  for (const change of changes) {
    const changeType = change.type ?? "unknown";
    countsByType[changeType] = (countsByType[changeType] ?? 0) + 1;
  }

  const KNOWN_TYPES = [
    "breaking_change",
    "addition",
    "fix",
    "improvement",
    "deprecation",
  ];

  const allTypes = [
    ...KNOWN_TYPES,
    ...Object.keys(countsByType).filter((t) => !KNOWN_TYPES.includes(t)),
  ];

  console.log("=== Changelog Summary (main) ===");
  console.log(`Total changes: ${changes.length}`);
  console.log("");
  console.log("By type:");
  for (const changeType of allTypes) {
    const count = countsByType[changeType] ?? 0;
    console.log(`  ${changeType}: ${count}`);
  }
  console.log("");
  console.log("Changes:");
  for (const change of changes) {
    const changeType = change.type ?? "unknown";
    const summary = truncate(change.summary ?? "(no summary)", 80);
    console.log(`  [${changeType}] ${summary}`);
  }
}

main();
