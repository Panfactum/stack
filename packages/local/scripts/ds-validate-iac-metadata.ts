#!/usr/bin/env bun
// Validates metadata.yaml against the infrastructure metadata JSON Schema.

import Ajv from "ajv";
import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

const METADATA_SCHEMA_PATH = "packages/infrastructure/metadata.schema.json";

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

  if (basename(filePath) !== "metadata.yaml") {
    result.errors.push(
      `Expected file named "metadata.yaml", got "${basename(filePath)}".`
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
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: ds-validate-iac-metadata <metadata.yaml> [metadata.yaml] ...\n" +
        "\n" +
        "Validates infrastructure metadata.yaml files against their JSON Schema.\n" +
        "Run from the repository root."
    );
    process.exit(1);
  }

  const schemaData = loadSchema(METADATA_SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schemaData);

  let allValid = true;

  for (const filePath of args) {
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
