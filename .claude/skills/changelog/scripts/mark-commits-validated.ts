#!/usr/bin/env bun
// Appends commit hashes to the validated list in main/review.yaml.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse, stringify } from "yaml";

const REVIEW_YAML_PATH = resolve(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog/main/review.yaml"
);

interface ReviewData {
  todo?: string[];
  validated?: string[];
}

function main(): void {
  const hashes = process.argv.slice(2);
  if (hashes.length === 0) {
    console.error(
      "Usage: bun ./scripts/mark-commits-validated.ts <hash> [hash...]"
    );
    process.exit(1);
  }

  // Validate that each argument looks like a full commit hash
  const hashPattern = /^[0-9a-f]{40}$/;
  for (const hash of hashes) {
    if (!hashPattern.test(hash)) {
      console.error(`Invalid commit hash: ${hash}`);
      process.exit(1);
    }
  }

  let data: ReviewData = {};
  if (existsSync(REVIEW_YAML_PATH)) {
    try {
      const content = readFileSync(REVIEW_YAML_PATH, "utf8");
      const parsed = parse(content) as ReviewData | null;
      if (parsed !== null && parsed !== undefined) {
        data = parsed;
      }
    } catch {
      console.error(`Failed to parse ${REVIEW_YAML_PATH}`);
      process.exit(1);
      return;
    }
  }

  const existing = new Set(Array.isArray(data.validated) ? data.validated : []);
  let added = 0;

  for (const hash of hashes) {
    if (!existing.has(hash)) {
      existing.add(hash);
      added++;
    }
  }

  data.validated = [...existing];

  writeFileSync(REVIEW_YAML_PATH, stringify(data, { lineWidth: 0 }), "utf8");

  console.log(
    `Marked ${added} commit(s) as validated (${hashes.length - added} already present). Total validated: ${data.validated.length}.`
  );
}

main();
