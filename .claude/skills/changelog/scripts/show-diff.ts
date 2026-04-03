#!/usr/bin/env bun
// Shows the combined diff for changed files relative to main (committed, staged, and unstaged).
// Usage: bun ./scripts/show-diff.ts [commit-hash]
// If a commit hash is provided, shows the diff for that specific commit.
// Files are filtered to user-facing paths via ../.changelog-include glob patterns.

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function runGit(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function runGitLines(command: string): string[] {
  return runGit(command)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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

function diffForCommit(hash: string, files: string[]): string {
  const fileArgs = files.map((f) => `"${f}"`).join(" ");
  return runGit(`git show ${hash} --format="" -- ${fileArgs}`);
}

function diffForFile(file: string): string {
  const committed = runGit(`git diff main...HEAD -- "${file}"`);
  const staged = runGit(`git diff --cached -- "${file}"`);
  const unstaged = runGit(`git diff -- "${file}"`);

  const parts: string[] = [];
  if (committed.length > 0) parts.push(`--- committed ---\n${committed}`);
  if (staged.length > 0) parts.push(`--- staged ---\n${staged}`);
  if (unstaged.length > 0) parts.push(`--- unstaged ---\n${unstaged}`);

  return parts.join("\n");
}

function main(): void {
  const hash = process.argv[2];
  const patterns = loadIncludePatterns();

  let allFiles: string[];

  if (hash) {
    allFiles = runGitLines(
      `git diff-tree --no-commit-id --name-only -r ${hash}`
    );
  } else {
    const committed = runGitLines("git diff main...HEAD --name-only");
    const staged = runGitLines("git diff --cached --name-only");
    const unstaged = runGitLines("git diff --name-only");
    allFiles = [...new Set([...committed, ...staged, ...unstaged])];
  }

  if (allFiles.length === 0) {
    console.log(
      hash
        ? `No changed files detected for commit ${hash}.`
        : "No changed files detected relative to main."
    );
    process.exit(0);
  }

  const files = filterFiles(allFiles, patterns);
  const excludedCount = allFiles.length - files.length;

  if (files.length === 0) {
    console.log("No user-facing changed files detected.");
    if (excludedCount > 0) {
      console.log(`(${excludedCount} non-user-facing files filtered out)`);
    }
    process.exit(0);
  }

  const sorted = files.sort();

  if (hash) {
    const diff = diffForCommit(hash, sorted);
    if (diff.length === 0) {
      console.log("(no diff)");
    } else {
      console.log(diff);
    }
  } else {
    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];
      if (file === undefined) continue;

      if (i > 0) console.log("");
      console.log(`=== ${file} ===`);

      const diff = diffForFile(file);
      if (diff.length === 0) {
        console.log("(no diff)");
      } else {
        console.log(diff);
      }
    }
  }

  if (excludedCount > 0) {
    console.log(`\n(${excludedCount} non-user-facing files filtered out)`);
  }
}

main();
