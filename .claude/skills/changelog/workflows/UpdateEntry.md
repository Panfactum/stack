# UpdateEntry Workflow

Add new structured changelog entries to `packages/website/src/content/changelog/main/log.yaml`,
using git diff analysis to determine what changed. This workflow runs non-interactively — it
analyzes changes, makes best-guess decisions, writes entries, and reports the result. The user
reviews the output after completion.

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| Commit hash | No | A specific git commit hash. When provided, the workflow scopes all analysis to that single commit instead of diffing the full branch against `main`. |
| Update description | No | A free-text description of the desired update. When provided, use it to guide which entries to add, modify, or remove and how to write summaries. When absent, infer everything from the diffs. |

## Prerequisites

Before proceeding, verify:

1. **log.yaml exists** — Check whether `packages/website/src/content/changelog/main/log.yaml` is present. If it does not exist, create it with the following minimal content and continue:
   ```yaml
   summary: ""
   changes: []
   ```
2. **Missing top-level `summary`** — If `log.yaml` exists but has no `summary` field (or is empty), proceed normally. Do not add a `summary` field automatically; leave that for the GenerateSummary workflow.

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step. Do NOT run git commands directly — all diff and file information comes from the provided scripts.

### 1. Read the Diffs

Run the show-diff script from the skill directory. **If a commit hash was provided**, pass it as an argument to scope to that single commit; otherwise, omit it to diff the full branch against `main`:

```bash
bun ./scripts/show-diff.ts [<hash>]
```

If the output says "No user-facing changed files detected", report that no user-facing changes were found and stop — do not create an empty entry.

When a commit hash is provided, the output begins with the full commit message under a `=== Commit Message ===` header. Use this message to inform entry summaries and as the `summary` for any `internal-commit` reference.

Understanding the actual changes (not just which files changed) is critical for writing accurate summaries and choosing the correct change type. Skim all diffs before proceeding.

### 2. Gather Context

Run the following command from the skill directory (`.claude/skills/changelog/`):

```bash
bun ./scripts/list-changes.ts
```

Read the output to understand what entries are already in `main/log.yaml`.

### 3. Map Changed Files to Component Suggestions

For each changed file path, apply the heuristics below to produce suggested `impact type` and `component` pairs. A single file may map to multiple impacts (e.g., a shared library change that affects several IaC modules, or a CLI command change that also impacts a devshell script).

| Changed File Path Pattern | Impact Type | Component Derivation |
|---------------------------|-------------|----------------------|
| `packages/infrastructure/<name>/` | `iac-module` | Directory name (e.g., `aws_eks`) |
| `packages/cli/src/commands/<path>/` | `cli` | Derived from the command's subcommand path (e.g., `buildkit build`) |
| `packages/nix/packages/scripts/<name>.sh` | `devshell` | Filename without `.sh` |

Files that do not match any pattern should be noted but do not automatically produce a component suggestion.

After mapping, cross-reference the suggested component names against the valid enums in the log schema (auto-loaded via the changelog-format reference doc). If a suggested component name is not present in the schema for its impact type, include it anyway and add a `todo` item to `packages/website/src/content/changelog/main/review.yaml` noting it is unverified.

### 4. Determine Entries

Analyze the diffs and group them into logical changes. Each logical change becomes one entry. Apply these rules:

- **Change type** — Choose from: `breaking_change`, `fix`, `improvement`, `addition`, `deprecation`, `update`. Base the choice on the nature of the diff (new files → `addition`, bug fixes → `fix`, removed/renamed public interfaces → `breaking_change`, version updates to third-party tooling → `update`, etc.).
- **Summary** — Write a one-to-two sentence description from the end user's perspective. Be specific — name the component and describe the observable effect.
- **Impacts** — Include the `type` and `component` pairs from Step 3, with a brief `summary` per impact.
- **action_items** — Include whenever the change requires user action (required for `breaking_change`, recommended for any type where users need to do something). Infer the steps from the diff. If the steps are unclear, write your best guess based on what was removed/renamed/changed.
- **references** — Include whenever the diff or commit message references a GitHub issue, PR, commit, or relevant docs. Applicable to all change types, not just fixes. Use the Exa search tools (`mcp__exa__web_search_exa`, `mcp__exa__get_code_context_exa`) to find relevant GitHub issues, PRs, upstream documentation, or migration guides that provide context for each change. For example, search for the component name + error symptom to find related issues, or search for upstream library changelogs when a dependency version changed. **If a commit hash was provided**, always include an `internal-commit` reference with the commit's subject as the `summary` and the full 40-character commit SHA as the `link`.
- **description** — Include when the change benefits from more context. Focus on the motivation behind the change, how it benefits the user, and how it aligns with the short-term and long-term project direction. The summary says *what* changed; the description explains *why* and *where this is heading*.

Omit optional fields entirely when not applicable.

Whenever you are uncertain about a decision — change type, summary wording, component mapping, whether something is a breaking change, inferred action items, etc. — add a `todo` item to the `todo` array in `packages/website/src/content/changelog/main/review.yaml`. Each todo should be a single string with enough context for a human to resolve it. Examples:

- `"Entry 'Consolidated cert modules': classified as breaking_change but could be improvement if no public API changed — verify with maintainer"`
- `"Entry 'Fixed RBAC permissions': inferred action_items from diff but unclear if users need to re-apply — confirm"`
- `"Component 'kube_foo' not in schema — is this a new module or a typo?"`

### 5. Review Existing Entries

Scan the existing `changes` array in `main/log.yaml` (already loaded in Step 2) against the new entries being added.

**Check for duplicates:**
- If a new entry has the same or very similar summary text, or affects the same component(s) as an existing entry, **skip the new entry** — do not create a duplicate. Note it in the final report.

**Check for invalidated entries:**
- The current diff may rename, remove, or supersede something referenced by a pre-existing entry (e.g., a module was renamed, a CLI command was removed, a previous fix was reverted).
- If a pre-existing entry is invalidated by the current changes, **update or remove it** as appropriate. Note every modification in the final report.

### 6. Write Entries to log.yaml

Write all changes to `packages/website/src/content/changelog/main/log.yaml` — this includes both new entries (appended to the `changes` array) and any modifications to pre-existing entries identified in Step 5.

MUST follow these rules when writing:

- **Create the `changes` key** if it does not exist, with the new entry as the first item.
- **Append new entries** to the end of the `changes` array.
- **Modify or remove pre-existing entries only when invalidated** by the current changes (as identified in Step 5). Do not alter entries that are still accurate.
- **Use `>-` block scalar style** for all multi-line `summary` values, matching the style of existing entries in the file.
- **Omit optional fields entirely** when they are not applicable — do not include empty arrays (`[]`) or null values (`~`). For example, omit `action_items` if there are none, omit `references` if there are none.
- **Maintain consistent indentation** (2 spaces) throughout the file.

After writing, read back the modified section to confirm the changes were applied correctly and the file is still valid YAML.

### 7. Validate the Result

Run the enhanced validation script to confirm the final state of `main/log.yaml` passes all checks:

```bash
bun ./scripts/validate-changelog.ts
```

Review the output:

- If there are **WARN-level findings** for the new entries, attempt to fix them automatically (e.g., add missing `action_items` for a `breaking_change`). If a fix cannot be determined, note it in the report.
- If there are **INFO-level findings**, note them in the report but do not block completion.
- If there are findings against **pre-existing entries** (not ones just added), note them separately in the report.

### 8. Report Results

Present a summary of everything that was done:

1. **Entries added** — List each new entry with its type, summary, and impacts.
2. **Entries modified** — List any pre-existing entries that were updated due to invalidation, with a brief explanation of what changed and why.
3. **Entries removed** — List any pre-existing entries that were removed because they are no longer accurate.
4. **Entries skipped** — List any new entries skipped due to duplicates.
5. **Todos** — List all `todo` items that were added to `review.yaml`. These are questions/concerns that need human review.
6. **Validation findings** — Summarize any WARN or INFO findings, including any that were auto-fixed.
8. **Upgrade instructions note** — If any `breaking_change` or `deprecation` entries were added, mention that the user may want to create or update `upgrade.mdx` for complex migration steps.
