#!/usr/bin/env bun
// Runs validation on main/log.yaml: JSON schema + enhanced completeness checks.

import Ajv from "ajv";
import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";

const CHANGELOG_DIR = join(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog"
);
const LOG_YAML_PATH = join(CHANGELOG_DIR, "main/log.yaml");
const LOG_SCHEMA_PATH = join(CHANGELOG_DIR, "log.schema.json");

interface Finding {
  level: "WARN" | "INFO";
  changeIndex: number;
  changeType: string;
  message: string;
}

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

interface Change {
  id: string;
  type: string;
  summary: string;
  description?: string;
  action_items?: string[];
  references?: ChangeReference[];
  impacts?: ChangeImpact[];
}

interface Group {
  type: string;
  summary: string;
  changes: string[];
}

interface LogData {
  summary?: string;
  upgrade_instructions?: string;
  highlights?: string[];
  groups?: Group[];
  changes?: Change[];
}

function truncateSummary(summary: string, maxLength = 60): string {
  const trimmed = summary.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return `"${trimmed}"`;
  }
  return `"${trimmed.slice(0, maxLength)}..."`;
}

function validateUpgradeInstructions(logData: LogData, logDir: string): Finding[] {
  const findings: Finding[] = [];
  const upgradeInstructions = logData.upgrade_instructions;

  if (typeof upgradeInstructions === "string" && upgradeInstructions !== "") {
    const upgradeAbsolutePath = join(logDir, upgradeInstructions);
    if (!existsSync(upgradeAbsolutePath)) {
      findings.push({
        level: "WARN",
        changeIndex: -1,
        changeType: "(root)",
        message: `upgrade_instructions references "${upgradeInstructions}" but the file does not exist at: ${upgradeAbsolutePath}`,
      });
    }
  }

  return findings;
}

function validateChange(change: Change, index: number): Finding[] {
  const findings: Finding[] = [];
  const changeNumber = index + 1;
  const changeType = change.type;
  const summaryLabel = truncateSummary(change.summary ?? "");

  // Check: breaking_change entries SHOULD have action_items
  if (changeType === "breaking_change") {
    const hasActionItems =
      Array.isArray(change.action_items) && change.action_items.length > 0;
    if (!hasActionItems) {
      findings.push({
        level: "WARN",
        changeIndex: changeNumber,
        changeType,
        message: `${summaryLabel} has no action_items — breaking changes should guide users on what to do`,
      });
    }
  }

  // Check: all entries SHOULD have references whenever possible
  const hasReferences =
    Array.isArray(change.references) && change.references.length > 0;
  if (!hasReferences) {
    findings.push({
      level: "INFO",
      changeIndex: changeNumber,
      changeType,
      message: `${summaryLabel} has no references — consider linking relevant issues, commits, or docs`,
    });
  }

  // Check: breaking_change, fix, and update entries SHOULD have impacts
  if (changeType === "breaking_change" || changeType === "fix" || changeType === "update") {
    const hasImpacts =
      Array.isArray(change.impacts) && change.impacts.length > 0;
    if (!hasImpacts) {
      findings.push({
        level: "INFO",
        changeIndex: changeNumber,
        changeType,
        message: `${summaryLabel} has no impacts — consider adding affected components`,
      });
    }
  }

  // Check: all entries with impacts SHOULD have impact summaries
  if (Array.isArray(change.impacts)) {
    for (const impact of change.impacts) {
      if (!impact.summary || impact.summary.trim() === "") {
        findings.push({
          level: "INFO",
          changeIndex: changeNumber,
          changeType,
          message: `Impact on "${impact.component}" (${impact.type}) has no summary — consider describing how this component is affected`,
        });
      }
    }
  }

  return findings;
}

function main(): void {
  const absolutePath = resolve(LOG_YAML_PATH);

  console.log("=== Enhanced Changelog Validation ===\n");
  console.log(`Checking: ${absolutePath}\n`);

  if (!existsSync(absolutePath)) {
    console.error(`Error: log.yaml not found at ${absolutePath}`);
    process.exit(1);
  }

  let logData: LogData;
  try {
    logData = parseYaml(readFileSync(absolutePath, "utf8")) as LogData;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: YAML parse failed: ${message}`);
    process.exit(1);
  }

  // JSON schema validation
  const schemaPath = resolve(LOG_SCHEMA_PATH);
  if (!existsSync(schemaPath)) {
    console.error(`Error: log.schema.json not found at ${schemaPath}`);
    process.exit(1);
  }
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(logData)) {
    console.log("Schema validation errors:\n");
    for (const err of validate.errors ?? []) {
      console.log(`  ${err.instancePath || "/"}: ${err.message}`);
    }
    console.log("");
    process.exit(1);
  }
  console.log("Schema validation passed.\n");

  const allFindings: Finding[] = [];
  const logDir = dirname(absolutePath);

  // Validate upgrade_instructions file existence
  allFindings.push(...validateUpgradeInstructions(logData, logDir));

  // Validate each change entry
  const changes = logData.changes ?? [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change !== undefined) {
      allFindings.push(...validateChange(change, i));
    }
  }

  // Check for duplicate id values
  const idCounts = new Map<string, number[]>();
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change?.id) {
      const indices = idCounts.get(change.id) ?? [];
      indices.push(i + 1);
      idCounts.set(change.id, indices);
    }
  }
  for (const [id, indices] of idCounts) {
    if (indices.length > 1) {
      allFindings.push({
        level: "WARN",
        changeIndex: indices[0] ?? 0,
        changeType: "(duplicate id)",
        message: `Duplicate id "${id}" found in changes #${indices.join(", #")}`,
      });
    }
  }

  // Check that group change IDs reference real change entries
  const validIds = new Set(changes.map((c) => c.id).filter(Boolean));
  const groups = logData.groups ?? [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group) continue;
    for (const refId of group.changes) {
      if (!validIds.has(refId)) {
        allFindings.push({
          level: "WARN",
          changeIndex: -1,
          changeType: "(group)",
          message: `Group #${g + 1} ("${truncateSummary(group.summary)}") references change id "${refId}" which does not exist in the changes array`,
        });
      }
    }
  }

  // Output all findings
  for (const finding of allFindings) {
    const location =
      finding.changeIndex === -1
        ? "(root)"
        : `Change #${finding.changeIndex} (${finding.changeType})`;
    console.log(`[${finding.level}] ${location}: ${finding.message}`);
  }

  const warnCount = allFindings.filter((f) => f.level === "WARN").length;
  const infoCount = allFindings.filter((f) => f.level === "INFO").length;

  if (allFindings.length > 0) {
    console.log("");
  }

  console.log("Summary:");
  console.log(`  Warnings: ${warnCount}`);
  console.log(`  Info: ${infoCount}`);
  console.log(`  Total changes checked: ${changes.length}`);

  if (warnCount > 0) {
    process.exit(1);
  }
}

main();
