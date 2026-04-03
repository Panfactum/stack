#!/usr/bin/env bun
// Lists all commits since the last edge release tag, with their changed files.

import { execSync } from "child_process";

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

function main(): void {
  // Find the most recent edge release tag by sorting semver-style
  const tagsRaw = run("git tag --sort=-v:refname");
  if (tagsRaw.length === 0) {
    console.log("No git tags found.");
    process.exit(0);
  }

  const tags = tagsRaw.split("\n").map((t) => t.trim());
  const latestEdge = tags.find((t) => t.startsWith("edge."));

  if (latestEdge === undefined) {
    console.log("No edge release tags found.");
    process.exit(0);
  }

  console.log(`=== Commits Since ${latestEdge} ===`);
  console.log("");

  // List commits (no merges) from the tag to HEAD
  const logRaw = run(
    `git -c log.showSignature=false log ${latestEdge}..HEAD --no-merges --format="%H %s"`
  );

  if (logRaw.length === 0) {
    console.log("No commits since the last edge release.");
    process.exit(0);
  }

  const lines = logRaw.split("\n").filter((l) => l.length > 0);
  console.log(`Total commits: ${lines.length}`);
  console.log("");

  for (const line of lines) {
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) continue;

    const hash = line.slice(0, spaceIdx);
    const subject = line.slice(spaceIdx + 1);

    // Get changed files for this commit
    const filesRaw = run(`git diff-tree --no-commit-id --name-only -r ${hash}`);
    const files = filesRaw.length > 0 ? filesRaw.split("\n") : [];

    console.log(`${hash.slice(0, 12)} ${subject}`);
    for (const file of files) {
      console.log(`  ${file}`);
    }
    console.log("");
  }
}

main();
