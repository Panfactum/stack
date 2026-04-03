#!/usr/bin/env bun
// Lists commit hashes since the last edge release that are not in the validated list in review.yaml.

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";

const REVIEW_YAML_PATH = resolve(
  import.meta.dir,
  "../../../../packages/website/src/content/changelog/main/review.yaml"
);

interface ReviewData {
  validated?: string[];
  [key: string]: unknown;
}

function run(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function loadValidated(): Set<string> {
  if (!existsSync(REVIEW_YAML_PATH)) {
    return new Set();
  }
  try {
    const content = readFileSync(REVIEW_YAML_PATH, "utf8");
    const data = parse(content) as ReviewData;
    if (Array.isArray(data.validated)) {
      return new Set(data.validated);
    }
  } catch {
    // File can't be parsed — treat as empty
  }
  return new Set();
}

function main(): void {
  const tagsRaw = run("git tag --sort=-v:refname");
  if (tagsRaw.length === 0) {
    process.exit(0);
  }

  const tags = tagsRaw.split("\n").map((t) => t.trim());
  const latestEdge = tags.find((t) => t.startsWith("edge."));

  if (latestEdge === undefined) {
    process.exit(0);
  }

  const logRaw = run(
    `git -c log.showSignature=false log ${latestEdge}..HEAD --no-merges --format="%H"`
  );

  if (logRaw.length === 0) {
    process.exit(0);
  }

  const allHashes = logRaw.split("\n").filter((l) => l.length > 0);
  const validated = loadValidated();

  const unvalidated = allHashes.filter((hash) => !validated.has(hash));

  // Reverse to chronological order (earliest first)
  unvalidated.reverse();

  for (const hash of unvalidated) {
    console.log(hash);
  }
}

main();
