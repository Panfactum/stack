#!/usr/bin/env bun
// Validates changelog review.yaml files against the generated JSON Schema.

import Ajv from "ajv";
import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, join, basename } from "path";

const CHANGELOG_DIR = "packages/website/src/content/changelog";
const REVIEW_SCHEMA_PATH = join(CHANGELOG_DIR, "review.schema.json");

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

  if (basename(filePath) !== "review.yaml") {
    result.errors.push(
      `Expected file named "review.yaml", got "${basename(filePath)}".`
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

  result.valid = true;
  return result;
}

function main(): void {
  let files = process.argv.slice(2);

  if (files.length === 0) {
    const glob = new Bun.Glob("**/review.yaml");
    files = Array.from(glob.scanSync({ cwd: CHANGELOG_DIR }))
      .map((f) => join(CHANGELOG_DIR, f))
      .sort();
    if (files.length === 0) {
      console.error("No review.yaml files found under " + CHANGELOG_DIR);
      process.exit(1);
    }
  }

  const schemaData = loadSchema(REVIEW_SCHEMA_PATH);
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
