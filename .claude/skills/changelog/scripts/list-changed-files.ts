#!/usr/bin/env bun
// Lists all files changed relative to main (committed, staged, and unstaged), deduplicated.

import { execSync } from "child_process";

function gitDiff(args: string): string[] {
  try {
    const output = execSync(`git diff ${args}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function main(): void {
  const committed = gitDiff("main...HEAD --name-only");
  const staged = gitDiff("--cached --name-only");
  const unstaged = gitDiff("--name-only");

  const all = new Set([...committed, ...staged, ...unstaged]);

  if (all.size === 0) {
    console.log("No changed files detected relative to main.");
    process.exit(0);
  }

  const sorted = [...all].sort();

  console.log(`=== Changed Files (${sorted.length}) ===`);
  for (const file of sorted) {
    console.log(file);
  }
}

main();
