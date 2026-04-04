#!/usr/bin/env bun
// Lists all files changed relative to main (committed, staged, and unstaged), deduplicated.
// Usage: bun ./scripts/list-changed-files.ts [commit-hash]
// If a commit hash is provided, lists only the files changed in that specific commit.
// Files are filtered to user-facing paths via ../.changelog-include glob patterns.

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function runGit(command: string): string[] {
  try {
    const output = execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_RTK: "1" },
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function loadIncludePatterns(): Bun.Glob[] {
  const includeFile = resolve(scriptDir, "..", ".changelog-include");
  const content = readFileSync(includeFile, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((pattern) => new Bun.Glob(pattern));
}

function filterFiles(files: string[], patterns: Bun.Glob[]): string[] {
  return files.filter((file) => patterns.some((glob) => glob.match(file)));
}

function main(): void {
  const hash = process.argv[2];

  let files: string[];

  if (hash) {
    files = runGit(`git diff-tree --no-commit-id --name-only -r ${hash}`);
  } else {
    const committed = runGit("git diff main...HEAD --name-only");
    const staged = runGit("git diff --cached --name-only");
    const unstaged = runGit("git diff --name-only");
    files = [...new Set([...committed, ...staged, ...unstaged])];
  }

  if (files.length === 0) {
    console.log(
      hash
        ? `No changed files detected for commit ${hash}.`
        : "No changed files detected relative to main."
    );
    process.exit(0);
  }

  const patterns = loadIncludePatterns();
  const included = filterFiles(files, patterns);
  const excludedCount = files.length - included.length;

  if (included.length === 0) {
    console.log("No user-facing changed files detected.");
    if (excludedCount > 0) {
      console.log(`(${excludedCount} non-user-facing files filtered out)`);
    }
    process.exit(0);
  }

  const sorted = included.sort();

  console.log(`=== Changed Files (${sorted.length}) ===`);
  for (const file of sorted) {
    console.log(file);
  }
  if (excludedCount > 0) {
    console.log(`(${excludedCount} non-user-facing files filtered out)`);
  }
}

main();
