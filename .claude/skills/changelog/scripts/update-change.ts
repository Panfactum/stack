#!/usr/bin/env bun
// Updates a single change entry in main/log.yaml by its UUID.
// Accepts field=value pairs as arguments.

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFileSync, writeFileSync, existsSync } from "fs";
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
  [key: string]: unknown;
}

interface ChangelogData {
  [key: string]: unknown;
  changes?: ChangeEntry[];
}

const VALID_TYPES = [
  "breaking_change",
  "fix",
  "improvement",
  "addition",
  "deprecation",
  "update",
];

const UPDATABLE_FIELDS = ["type", "summary", "description"];

function printUsage(): void {
  console.error("Usage: bun ./scripts/update-change.ts <change-id> <field>=<value> [field=value ...]");
  console.error("");
  console.error("  <change-id>      Full or partial UUID of the change entry");
  console.error("  <field>=<value>  Field to update. Updatable fields:");
  console.error(`                     type        One of: ${VALID_TYPES.join(", ")}`);
  console.error("                     summary     New summary text");
  console.error("                     description New description text (use 'description=' to remove)");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const targetId = args[0]!;
  const updates = args.slice(1);

  // Parse field=value pairs
  const fieldUpdates = new Map<string, string>();
  for (const arg of updates) {
    const eqIndex = arg.indexOf("=");
    if (eqIndex === -1) {
      console.error(`Error: Invalid argument "${arg}" — expected field=value format.`);
      printUsage();
      process.exit(1);
    }
    const field = arg.slice(0, eqIndex);
    const value = arg.slice(eqIndex + 1);
    if (!UPDATABLE_FIELDS.includes(field)) {
      console.error(`Error: Unknown field "${field}". Updatable fields: ${UPDATABLE_FIELDS.join(", ")}`);
      process.exit(1);
    }
    fieldUpdates.set(field, value);
  }

  // Validate type if provided
  const newType = fieldUpdates.get("type");
  if (newType !== undefined && !VALID_TYPES.includes(newType)) {
    console.error(`Error: Invalid type "${newType}". Must be one of: ${VALID_TYPES.join(", ")}`);
    process.exit(1);
  }

  if (!existsSync(LOG_YAML_PATH)) {
    console.error("Error: log.yaml not found.");
    process.exit(1);
  }

  const raw = readFileSync(LOG_YAML_PATH, "utf8");
  let data: ChangelogData;
  try {
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

  // Apply updates
  const applied: string[] = [];
  for (const [field, value] of fieldUpdates) {
    const oldValue = String(change[field] ?? "(unset)");
    if (value === "" && field === "description") {
      delete change[field];
      applied.push(`  ${field}: removed`);
    } else {
      (change as Record<string, unknown>)[field] = value;
      applied.push(`  ${field}: ${oldValue} → ${value}`);
    }
  }

  // Write back — use line-based replacement to preserve formatting of untouched entries.
  // Since surgical YAML edits are fragile, we re-serialize the full document.
  writeFileSync(LOG_YAML_PATH, stringifyYaml(data, { lineWidth: 120 }));

  console.log(`Updated change #${index + 1} (${change.id}):`);
  for (const line of applied) {
    console.log(line);
  }
  console.log("");
  console.log("Note: File was re-serialized. Review the diff to confirm formatting is acceptable.");
}

main();
