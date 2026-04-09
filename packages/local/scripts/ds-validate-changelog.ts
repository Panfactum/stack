#!/usr/bin/env bun
// Validates changelog log.yaml files against the generated JSON Schema.

import Ajv from "ajv";
import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join, basename } from "path";

const CHANGELOG_DIR = "packages/website/src/content/changelog";
const LOG_SCHEMA_PATH = join(CHANGELOG_DIR, "log.schema.json");

interface ValidationResult {
  filePath: string;
  valid: boolean;
  errors: string[];
}

function loadSchema(schemaPath: string): unknown {
  const absolutePath = resolve(schemaPath);
  if (!existsSync(absolutePath)) {
    console.error(
      `Error: Schema file not found at ${absolutePath}\n` +
        `Run the schema generation script first:\n` +
        `  ds-generate-changelog-schemas`
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
}

function isMainLog(filePath: string): boolean {
  return resolve(filePath) === resolve(join(CHANGELOG_DIR, "main/log.yaml"));
}

function validateFile(
  filePath: string,
  validate: Ajv["validate"]
): ValidationResult {
  const absolutePath = resolve(filePath);
  const result: ValidationResult = {
    filePath: absolutePath,
    valid: false,
    errors: [],
  };

  if (!existsSync(absolutePath)) {
    result.errors.push(`File not found: ${absolutePath}`);
    return result;
  }

  if (basename(filePath) !== "log.yaml") {
    result.errors.push(
      `Expected file named "log.yaml", got "${basename(filePath)}".`
    );
    return result;
  }

  let data: unknown;
  try {
    data = parseYaml(readFileSync(absolutePath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`YAML parse error: ${message}`);
    return result;
  }

  const isValid = validate(data);

  if (!isValid && Array.isArray(validate.errors)) {
    for (const error of validate.errors) {
      const fieldPath =
        error.instancePath !== "" ? error.instancePath : "(root)";
      const message = error.message ?? "unknown error";
      const extra =
        error.params !== undefined && Object.keys(error.params).length > 0
          ? ` (${JSON.stringify(error.params)})`
          : "";
      result.errors.push(`Field "${fieldPath}": ${message}${extra}`);
    }
    return result;
  }

  // Validate that the upgrade_instructions file exists on disk
  const logData = data as Record<string, unknown>;
  const upgradeInstructions = logData["upgrade_instructions"];
  if (typeof upgradeInstructions === "string" && upgradeInstructions !== "") {
    const logDir = dirname(absolutePath);
    const upgradeAbsolutePath = join(logDir, upgradeInstructions);

    if (!existsSync(upgradeAbsolutePath)) {
      result.errors.push(
        `Field "upgrade_instructions": referenced file does not exist: ${upgradeAbsolutePath}`
      );
      return result;
    }
  }

  // Validate that internal-docs references point to /docs/main/ (only for main/log.yaml)
  if (isMainLog(filePath)) {
    const changes = (logData["changes"] ?? []) as Array<{
      references?: Array<{ type: string; link: string }>;
    }>;
    for (let i = 0; i < changes.length; i++) {
      const refs = changes[i]?.references;
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (
          ref.type === "internal-docs" &&
          ref.link.startsWith("/docs/") &&
          !ref.link.startsWith("/docs/main/")
        ) {
          result.errors.push(
            `Field "/changes/${i}/references": internal-docs reference links to "${ref.link}" but versioned docs references must point to /docs/main/`
          );
        }
      }
    }
  }
  if (result.errors.length > 0) {
    return result;
  }

  result.valid = true;
  return result;
}

function main(): void {
  let files = process.argv.slice(2);

  if (files.length === 0) {
    const glob = new Bun.Glob("**/log.yaml");
    files = Array.from(glob.scanSync({ cwd: CHANGELOG_DIR }))
      .map((f) => join(CHANGELOG_DIR, f))
      .sort();
    if (files.length === 0) {
      console.error("No log.yaml files found under " + CHANGELOG_DIR);
      process.exit(1);
    }
  }

  const schemaData = loadSchema(LOG_SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schemaData);

  let allValid = true;

  for (const filePath of files) {
    const result = validateFile(filePath, validate);

    if (result.valid) {
      console.log(`✓ ${filePath}`);
    } else {
      allValid = false;
      console.error(`✗ ${filePath}`);
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
    }
  }

  if (!allValid) {
    process.exit(1);
  }
}

main();
