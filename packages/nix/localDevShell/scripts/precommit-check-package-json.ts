#!/usr/bin/env bun
// Validates package.json files across the monorepo:
// 1. All dependencies, devDependencies, and peerDependencies must be pinned
//    to exact versions (no ^, ~, >=, etc.)
// 2. When the same package appears in the dependencies or devDependencies of
//    multiple package.json files, versions must match

import { readFileSync } from "fs";
import { relative, resolve } from "path";
import { execSync } from "child_process";

type Section = "dependencies" | "devDependencies" | "peerDependencies";

interface DepEntry {
  name: string;
  version: string;
  file: string;
  section: Section;
}

const UNPINNED_PREFIX_RE = /^[\^~><=*]/;
const LINK_PREFIXES = ["link:", "workspace:"];

function getRepoRoot(): string {
  if (process.env["REPO_ROOT"]) {
    return process.env["REPO_ROOT"];
  }
  return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
}

function findPackageJsonFiles(repoRoot: string): string[] {
  const glob = new Bun.Glob("**/package.json");
  const files: string[] = [];
  for (const match of glob.scanSync({
    cwd: repoRoot,
    absolute: true,
    onlyFiles: true,
  })) {
    if (
      match.includes("/node_modules/") ||
      match.includes("/.terraform/") ||
      match.includes("/.terragrunt-cache/") ||
      match.includes("/.pnpm/")
    ) {
      continue;
    }
    files.push(match);
  }
  return files.sort();
}

function isLocalDep(version: string): boolean {
  return LINK_PREFIXES.some((prefix) => version.startsWith(prefix));
}

function collectDeps(repoRoot: string, pkgPath: string): DepEntry[] {
  const relPath = relative(repoRoot, pkgPath);
  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const entries: DepEntry[] = [];
  const sections: Section[] = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ];

  for (const section of sections) {
    const deps = parsed[section];
    if (typeof deps !== "object" || deps === null) continue;
    for (const [name, version] of Object.entries(
      deps as Record<string, string>
    )) {
      if (typeof version !== "string") continue;
      if (isLocalDep(version)) continue;
      entries.push({ name, version, file: relPath, section });
    }
  }

  return entries;
}

function checkUnpinned(entries: DepEntry[]): string[] {
  const errors: string[] = [];
  for (const entry of entries) {
    if (UNPINNED_PREFIX_RE.test(entry.version)) {
      errors.push(
        `  ${entry.file} (${entry.section}): ${entry.name} @ ${entry.version}`
      );
    }
  }
  return errors;
}

function checkConsistency(entries: DepEntry[]): string[] {
  // Only deps + devDeps participate in cross-package consistency.
  const relevant = entries.filter(
    (e) => e.section === "dependencies" || e.section === "devDependencies"
  );

  const byName = new Map<string, DepEntry[]>();
  for (const entry of relevant) {
    const list = byName.get(entry.name) ?? [];
    list.push(entry);
    byName.set(entry.name, list);
  }

  const errors: string[] = [];
  const sortedNames = Array.from(byName.keys()).sort();
  for (const name of sortedNames) {
    const list = byName.get(name)!;
    const versions = new Set(list.map((e) => e.version));
    if (versions.size <= 1) continue;
    errors.push(`  ${name}:`);
    for (const entry of list) {
      errors.push(`    ${entry.file}: ${entry.version}`);
    }
  }
  return errors;
}

function main(): void {
  const repoRoot = resolve(getRepoRoot());
  const pkgFiles = findPackageJsonFiles(repoRoot);
  if (pkgFiles.length === 0) {
    return;
  }

  const allEntries = pkgFiles.flatMap((pkg) => collectDeps(repoRoot, pkg));

  const unpinnedErrors = checkUnpinned(allEntries);
  const consistencyErrors = checkConsistency(allEntries);

  let hasErrors = false;

  if (unpinnedErrors.length > 0) {
    hasErrors = true;
    console.error("ERROR: Unpinned dependencies found:");
    for (const line of unpinnedErrors) console.error(line);
    console.error("All dependencies must use exact pinned versions.");
    console.error("");
  }

  if (consistencyErrors.length > 0) {
    hasErrors = true;
    console.error("ERROR: Inconsistent dependency versions across packages:");
    for (const line of consistencyErrors) console.error(line);
    console.error(
      "All packages must use the same version for shared dependencies."
    );
    console.error("");
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main();
