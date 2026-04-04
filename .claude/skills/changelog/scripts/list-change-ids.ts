#!/usr/bin/env bun
// Lists all change IDs in main/log.yaml with their type and truncated summary.

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

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("No log.yaml found — changelog has not been created yet.");
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

  if (changes.length === 0) {
    console.log("No changes found in main/log.yaml.");
    return;
  }

  console.log(`=== Change IDs (${changes.length}) ===`);
  console.log("");
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]!;
    const summary = truncate(change.summary ?? "(no summary)", 60);
    console.log(`${change.id}  [${change.type}] ${summary}`);
  }
}

main();
