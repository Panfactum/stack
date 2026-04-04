#!/usr/bin/env bun
// Checks whether upgrade instructions are required based on breaking changes
// and deprecations in main/log.yaml.
// Exit codes:
//   0 — No breaking changes or deprecations; upgrade instructions not needed.
//   1 — Breaking changes exist but upgrade instructions file is missing or unset.
//   2 — Breaking changes exist and upgrade instructions file already exists.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const LOG_YAML_PATH = join(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface Change {
  type: string;
  summary: string;
}

interface LogData {
  upgrade_instructions?: string;
  changes?: Change[];
}

const UPGRADE_TYPES = ["breaking_change", "deprecation"];

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("No log.yaml found — upgrade instructions not required.");
    process.exit(0);
  }

  let data: LogData;
  try {
    const raw = readFileSync(LOG_YAML_PATH, "utf8");
    data = parseYaml(raw) as LogData;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to parse log.yaml: ${message}`);
    process.exit(1);
  }

  const logDir = dirname(LOG_YAML_PATH);
  const changes = data.changes ?? [];
  const items = changes.filter((c) => UPGRADE_TYPES.includes(c.type));

  if (items.length === 0) {
    console.log("No breaking changes or deprecations — upgrade instructions not required.");
    process.exit(0);
  }

  console.log(`Found ${items.length} breaking change(s)/deprecation(s):`);
  for (const item of items) {
    console.log(`  [${item.type}] ${item.summary.replace(/\s+/g, " ").trim()}`);
  }

  const upgradeFile = data.upgrade_instructions;
  if (typeof upgradeFile === "string" && upgradeFile !== "") {
    const filePath = join(logDir, upgradeFile);
    if (existsSync(filePath)) {
      console.log(`\nUpgrade instructions file exists: ${upgradeFile}`);
      process.exit(2);
    } else {
      console.log(`\nupgrade_instructions is set to "${upgradeFile}" but the file is MISSING.`);
      process.exit(1);
    }
  } else {
    console.log("\nupgrade_instructions is not set in log.yaml.");
    process.exit(1);
  }
}

main();
