#!/usr/bin/env bun
// Lists session log entries added in a commit, or all entries for the current branch.
// Usage: bun ./scripts/list-log-entries.ts [<commit-hash>]
// If a commit hash is provided, reads the .claude/log/*.json files committed in that commit.
// If omitted, reads all .claude/log/*.json files changed on this branch since main.

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(scriptDir, "../../../..");

interface LogEntry {
  motivation: string;
  summary: string;
}

interface LogFile {
  changes: LogEntry[];
  problems?: string[];
  session_id: string;
  timestamp: string;
}

function run(cmd: string): string {
  try {
    return execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_RTK: "1" },
    }).trim();
  } catch {
    return "";
  }
}

function getLogFiles(ref: string): string[] {
  return run(`git diff-tree --no-commit-id --name-only -r ${ref}`)
    .split("\n")
    .filter((f) => f.startsWith(".claude/log/") && f.endsWith(".json"));
}

function printEntries(logFiles: string[], header: string, ref = "HEAD"): void {
  console.log(header);
  console.log("");

  let found = false;

  for (const file of logFiles) {
    let log: LogFile;
    try {
      const content = run(`git -c log.showSignature=false show ${ref}:${file}`);
      log = JSON.parse(content) as LogFile;
    } catch {
      continue;
    }

    for (const entry of log.changes ?? []) {
      found = true;
      console.log(`- ${entry.summary}`);
      if (entry.motivation) {
        console.log(`  motivation: ${entry.motivation}`);
      }
      console.log("");
    }
  }

  if (!found) {
    console.log("No session log entries found.");
  }
}

function main(): void {
  const hash = process.argv[2];

  if (hash) {
    const subject = run(
      `git -c log.showSignature=false show -s --format="%s" ${hash}`
    );
    if (!subject) {
      console.error(`Error: Could not resolve commit ${hash}`);
      process.exit(1);
    }

    const logFiles = getLogFiles(hash);
    if (logFiles.length === 0) {
      console.log("No session log entries found for this commit.");
      process.exit(0);
    }

    printEntries(logFiles, `=== Session Log Entries for ${hash.slice(0, 12)} — ${subject} ===`, hash);
  } else {
    const logFiles = run("git diff main...HEAD --name-only")
      .split("\n")
      .filter((f) => f.startsWith(".claude/log/") && f.endsWith(".json"));

    if (logFiles.length === 0) {
      console.log("No session log entries found for this branch.");
      process.exit(0);
    }

    printEntries(logFiles, "=== Session Log Entries for Branch ===");
  }
}

main();
