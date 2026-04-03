#!/usr/bin/env bun
// Shows the combined diff for specified files relative to main (committed, staged, and unstaged).

import { execSync } from "child_process";

function gitDiff(args: string): string {
  try {
    return execSync(`git diff ${args}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function diffForFile(file: string): string {
  const committed = gitDiff(`main...HEAD -- "${file}"`);
  const staged = gitDiff(`--cached -- "${file}"`);
  const unstaged = gitDiff(`-- "${file}"`);

  const parts: string[] = [];
  if (committed.length > 0) parts.push(`--- committed ---\n${committed}`);
  if (staged.length > 0) parts.push(`--- staged ---\n${staged}`);
  if (unstaged.length > 0) parts.push(`--- unstaged ---\n${unstaged}`);

  return parts.join("\n");
}

function main(): void {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error("Usage: bun ./scripts/show-diff.ts <file> [file...]");
    console.error("Shows the combined diff (committed, staged, unstaged) for each file.");
    process.exit(1);
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
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

main();
