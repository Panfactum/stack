#!/usr/bin/env bun
// Lists breaking changes and deprecations from main/log.yaml that need upgrade instructions.
// Outputs each entry's summary, action_items, impacts, and references — the fields needed
// to draft upgrade.mdx sections.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const LOG_YAML_PATH = join(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog/main/log.yaml"
);

interface ChangeImpact {
  type: string;
  component: string;
  summary?: string;
}

interface ChangeReference {
  type: string;
  summary: string;
  link: string;
}

interface Change {
  type: string;
  summary: string;
  description?: string;
  action_items?: string[];
  impacts?: ChangeImpact[];
  references?: ChangeReference[];
}

interface LogData {
  upgrade_instructions?: string;
  changes?: Change[];
}

const UPGRADE_TYPES = ["breaking_change", "deprecation"];

function main(): void {
  if (!existsSync(LOG_YAML_PATH)) {
    console.log("No log.yaml found — nothing to extract.");
    return;
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

  // Status header
  console.log("=== Upgrade Items ===\n");

  const upgradeFile = data.upgrade_instructions;
  if (typeof upgradeFile === "string" && upgradeFile !== "") {
    const exists = existsSync(join(logDir, upgradeFile));
    console.log(
      `upgrade_instructions: ${upgradeFile} (${exists ? "exists" : "MISSING"})`
    );
  } else {
    console.log("upgrade_instructions: not set");
  }

  console.log(
    `Found: ${items.length} item(s) (${changes.length} total changes)\n`
  );

  if (items.length === 0) {
    console.log("No breaking changes or deprecations — no upgrade instructions needed.");
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const hasActions =
      Array.isArray(item.action_items) && item.action_items.length > 0;

    console.log(`--- [${i + 1}] ${item.type} ---`);
    console.log(`summary: ${item.summary.replace(/\s+/g, " ").trim()}`);

    if (item.description) {
      console.log(
        `description: ${item.description.replace(/\s+/g, " ").trim()}`
      );
    }

    if (hasActions) {
      console.log("action_items:");
      for (const action of item.action_items!) {
        console.log(`  - ${action}`);
      }
    } else {
      console.log("action_items: (none)");
    }

    if (Array.isArray(item.impacts) && item.impacts.length > 0) {
      console.log("impacts:");
      for (const impact of item.impacts) {
        const summary = impact.summary ? ` — ${impact.summary}` : "";
        console.log(`  - [${impact.type}] ${impact.component}${summary}`);
      }
    }

    if (Array.isArray(item.references) && item.references.length > 0) {
      console.log("references:");
      for (const ref of item.references) {
        console.log(`  - [${ref.type}] ${ref.summary}: ${ref.link}`);
      }
    }

    console.log("");
  }
}

main();
