[//]: # "Reference document for CLI scripts available in the changelog skill."
[//]: # "Scripts live in the scripts/ directory and are run with Bun."

# CLI Tools

Scripts available in the `scripts/` directory for the changelog skill. Run from the skill directory (`.claude/skills/changelog/`).

All scripts use `#!/usr/bin/env bun` and can be run directly or via `bun`:

```bash
bun ./scripts/<script-name>.ts
```

## list-changes.ts

Lists current changelog entries in `main/log.yaml` with counts by type. Outputs a human-readable summary of all changes and their types.

**Usage:**

```bash
bun ./scripts/list-changes.ts
```

**Arguments:** None

**Output:** A summary block showing total change count, a breakdown by type (breaking\_change, addition, fix, improvement, deprecation), and a flat list of all changes with their type and truncated summary. Example:

```
=== Changelog Summary (main) ===
Total changes: 3

By type:
  breaking_change: 1
  addition: 1
  fix: 1

Changes:
  [breaking_change] Removed support for legacy auth tokens
  [addition] Added new dashboard widget API
  [fix] Corrected rate-limit header parsing
```

## list-changed-files.ts

Lists all files changed relative to `main`, combining committed branch changes, staged changes, and unstaged changes into a single deduplicated list. Used by the UpdateEntry workflow to discover what was modified.

**Usage:**

```bash
bun ./scripts/list-changed-files.ts
```

**Arguments:** None

**Output:** A sorted list of changed file paths with a total count. Example:

```
=== Changed Files (3) ===
packages/infrastructure/aws_eks/main.tf
packages/nix/packages/default.nix
packages/website/src/content/changelog/main/log.yaml
```

If no changes are detected, prints a message and exits with code `0`.

## show-diff.ts

Shows the combined diff (committed, staged, and unstaged) for one or more files relative to `main`. Used by the UpdateEntry workflow to read the actual changes and write accurate summaries.

**Usage:**

```bash
bun ./scripts/show-diff.ts <file> [file...]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `file` | Yes | One or more file paths to show diffs for. |

**Output:** Per-file sections with labeled diff hunks (committed, staged, unstaged). Only non-empty diff sources are shown. Example:

```
=== packages/infrastructure/aws_eks/main.tf ===
--- committed ---
diff --git a/packages/infrastructure/aws_eks/main.tf b/packages/infrastructure/aws_eks/main.tf
...

=== packages/nix/packages/default.nix ===
--- unstaged ---
diff --git a/packages/nix/packages/default.nix b/packages/nix/packages/default.nix
...
```

## list-commits-since-release.ts

Lists all non-merge commits since the last edge release tag, along with the files changed by each commit. Used by the ValidateChangelog workflow to check that every meaningful change has a corresponding changelog entry.

**Usage:**

```bash
bun ./scripts/list-commits-since-release.ts
```

**Arguments:** None

**Output:** The release tag used as the baseline, the total commit count, and each commit's short hash, subject line, and changed files. Example:

```
=== Commits Since edge.25-04-03 ===

Total commits: 12

02becf232c45 fix(buildkit): allow scale-up command to run without devshell
  packages/cli/src/commands/buildkit/resume/command.ts
  packages/infrastructure/kube_constants/main.tf

81808b61f0e7 perf(sops-set-profile): skip YAML parsing for non-SOPS files early
  packages/cli/src/commands/wf/sops-set-profile/command.ts
```

If no edge release tags exist or no commits are found since the last tag, prints a message and exits with code `0`.

## list-unvalidated-commits.ts

Lists commit hashes since the last edge release that have not yet been reviewed by the ValidateChangelog workflow. Reads the `validated` array from `main/review.yaml` and filters it against all non-merge commits since the last `edge.*` tag.

**Usage:**

```bash
bun ./scripts/list-unvalidated-commits.ts
```

**Arguments:** None

**Output:** Full 40-character commit hashes, one per line, in chronological order (earliest first). Example:

```
e1fa94d5f8fcde71bec61784dc6c3df9bf2b11be
7d7349f621f9b979a1bc660b409d96eef5c0ce3c
02becf232c45cdeae884c24a05d59c6e009c4fc9
```

Produces no output and exits with code `0` if there are no unvalidated commits, no edge release tags, or no git tags.

## mark-commits-validated.ts

Appends one or more commit hashes to the `validated` array in `main/review.yaml`. Skips hashes that are already present. Used by the ValidateChangelog workflow to record which commits have been reviewed.

**Usage:**

```bash
bun ./scripts/mark-commits-validated.ts <hash> [hash...]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `hash` | Yes | One or more full 40-character git commit hashes to mark as validated. |

**Output:** A confirmation line showing how many were added and the new total. Example:

```
Marked 3 commit(s) as validated (1 already present). Total validated: 15.
```

Exits with code `1` if any argument is not a valid 40-character hex hash or if `review.yaml` cannot be parsed.

## list-summary-inputs.ts

Lists the fields from `main/log.yaml` needed to generate the release summary and highlights. Outputs any existing `summary` and `highlights`, then each change with its type, summary, action\_items, and impacts. Omits references and descriptions to keep the output focused on what matters for drafting.

**Usage:**

```bash
bun ./scripts/list-summary-inputs.ts
```

**Arguments:** None

**Output:** Existing top-level fields followed by each change entry with the fields relevant to summary generation. Example:

```
=== Summary Inputs ===

existing summary: (none)
existing highlights: (none)

Total changes: 3

--- [1] breaking_change ---
summary: `kube_cert_manager` and `kube_cert_issuers` consolidated into `kube_certificates`
action_items:
  - Create a new `kube_certificates` module deployment.
  - Migrate the Terraform state.
impacts:
  - [iac-module] kube_cert_manager — Deprecated
  - [iac-module] kube_certificates — Replacement module

--- [2] addition ---
summary: Added new dashboard widget API
impacts:
  - [cli] dashboard-widgets — New command

--- [3] fix ---
summary: Corrected rate-limit header parsing
```

## list-upgrade-items.ts

Lists breaking changes and deprecations from `main/log.yaml` that need upgrade instructions. Extracts each entry's summary, action\_items, impacts, and references — the fields needed to draft `upgrade.mdx` sections. Used by the GenerateUpgradeInstructions workflow.

**Usage:**

```bash
bun ./scripts/list-upgrade-items.ts
```

**Arguments:** None

**Output:** A status header showing whether `upgrade_instructions` is set and whether the file exists, followed by each breaking change or deprecation with its summary, description, action\_items, impacts, and references. Example:

```
=== Upgrade Items ===

upgrade_instructions: upgrade.mdx (exists)
Found: 2 item(s) (5 total changes)

--- [1] breaking_change ---
summary: `old_module` consolidated into `new_module`
action_items:
  - Create a new `new_module` deployment.
  - Migrate the Terraform state.
impacts:
  - [iac-module] old_module — Deprecated
  - [iac-module] new_module — Replacement module

--- [2] breaking_change ---
summary: Default Kubernetes version updated to 1.31
description: Review the changelog for deprecated APIs.
action_items: (none)
impacts:
  - [iac-module] aws_eks — Default version updated
```

If there are no breaking changes or deprecations, prints a message and exits with code `0`.

## upgrade-instructions-required.ts

Checks whether upgrade instructions are required based on breaking changes and deprecations in `main/log.yaml`. Used by the ValidateChangelog workflow to decide whether to generate upgrade instructions.

**Usage:**

```bash
bun ./scripts/upgrade-instructions-required.ts
```

**Arguments:** None

**Exit codes:**

- `0` — Not required (no breaking changes/deprecations) or already present (file exists on disk).
- `1` — Required but missing (`upgrade_instructions` not set or referenced file does not exist).

**Output:** Lists any breaking changes/deprecations found and reports the status of the upgrade instructions file. Example when missing:

```
Found 2 breaking change(s)/deprecation(s):
  [breaking_change] `old_module` consolidated into `new_module`
  [deprecation] `legacy_auth` deprecated in favor of `oauth2_proxy`

upgrade_instructions is not set in log.yaml.
```

## validate-changelog.ts

Runs enhanced validation on `main/log.yaml` beyond schema checking. Checks completeness rules such as missing `action_items` on breaking changes, missing `references` on fixes, missing `impacts`, and missing impact summaries.

**Usage:**

```bash
bun ./scripts/validate-changelog.ts
```

**Arguments:** None

**Output:** A report of all findings with level (`WARN` or `INFO`), the affected change location, and a descriptive message. Exits with code `1` if any `WARN`-level findings are present. Example:

```
=== Enhanced Changelog Validation ===

Checking: /path/to/packages/website/src/content/changelog/main/log.yaml

[WARN] Change #2 (breaking_change): "Removed legacy auth tokens" has no action_items — breaking changes should guide users on what to do
[INFO] Change #3 (fix): "Corrected rate-limit header parsing" has no impacts — consider adding affected components

Summary:
  Warnings: 1
  Info: 1
  Total changes checked: 3
```
