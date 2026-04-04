[//]: # "Workflow for validating changelog commit coverage, structural checks, and quality."
[//]: # "Primary goal: ensure every commit since the last edge release is captured in the changelog."

# ValidateChangelog Workflow

Ensure every meaningful commit since the last edge release is captured in `main/log.yaml`,
that the file passes all structural validation checks, and that all entries meet quality
standards. This workflow runs non-interactively — it reviews commits, creates missing entries
via subagents, runs validation, applies quality fixes, and reports the result. The user
reviews the output after completion.

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step.

### 1. Check Commit Coverage

Ensure every meaningful change since the last edge release is captured in the changelog. Only commits not already in the `validated` list are analyzed.

Run the unvalidated commits script from the skill directory:

```bash
bun ./scripts/list-unvalidated-commits.ts
```

This outputs the full hashes of all non-merge commits since the last `edge.*` tag that are not in the `validated` array in `main/review.yaml`, one per line, in chronological order (earliest first). If there is no output, all commits are validated — skip to Step 2.

For each hash in the output, spawn a `changelog-commit-reviewer` subagent (defined in `.claude/agents/changelog-commit-reviewer.md`), passing the hash. The agent reviews the commit and determines whether a changelog entry is needed.

**Execution rules:**

- Process commits **sequentially** (one subagent at a time), because each may modify `log.yaml` and subsequent invocations must see the updated state.
- After each subagent completes, run the mark-validated script to record the commit hash:

```bash
bun ./scripts/mark-commits-validated.ts <hash>
```

### 2. Validate Upgrade Instructions

Run the upgrade instructions check from the skill directory:

```bash
bun ./scripts/upgrade-instructions-required.ts
```

Exit codes:
- **0** — No breaking changes; skip to Step 3.
- **1** — Breaking changes exist but upgrade instructions file is missing or unset.
- **2** — Breaking changes exist and upgrade instructions file already exists.

If the script exits with code 1 or 2 (breaking changes present), spawn a subagent to run the **GenerateUpgradeInstructions** workflow (via the changelog skill) to create or update the upgrade instructions before continuing.

### 3. Review Todo Items

Read the `todo` array from `packages/website/src/content/changelog/main/review.yaml`. If there are no todo items, skip to Step 4.

For each todo item:

1. **Understand the concern** — Parse what decision or information the todo is asking for.
2. **Research** — Use the codebase (read relevant source files, diffs, commit messages) and Exa search tools (`mcp__exa__web_search_exa`, `mcp__exa__get_code_context_exa`) to gather the information needed to resolve the item.
3. **Propose a fix** — Present the todo text, your findings, and a concrete recommended resolution. Format each proposal as:

```
TODO: <original todo text>
FINDING: <what you discovered>
RECOMMENDATION: <specific change to make, or "Remove — no action needed" if the concern is resolved>
```

Collect all proposals and present them to the user for review. Do **not** apply changes automatically — the user decides which proposals to accept.

### 4. Condense Related Entries

Spawn a `changelog-condenser` subagent (defined in `.claude/agents/changelog-condenser.md`) to review the full changelog and merge related or redundant entries. The agent runs the **CondenseEntries** workflow and returns a summary of what was merged.

### 5. Generate Summary

Spawn a subagent to run the **GenerateSummary** workflow (via the changelog skill) to generate or update the top-level `summary` and `highlights` fields based on the final set of condensed entries.

### 6. Quality Review

Run the list-change-ids script to get every change ID:

```bash
bun ./scripts/list-change-ids.ts
```

For each change ID in the output, spawn a subagent to run the **EnhanceEntry** workflow (via the changelog skill), passing the change ID as the entry identifier. Run subagents **in parallel** (up to 5 at a time) since each operates on a single entry independently.

After all subagents complete, collect their before/after reports for the final summary.

### 7. Run the Automated Validation Script

Run the validation script from the skill directory:

```bash
bun ./scripts/validate-changelog.ts
```

Capture the full output. Note whether the script exits with code 0 (no warnings) or 1 (warnings present). The script checks:

- Breaking changes without `action_items`
- Entries without `references`
- Entries missing `impacts` where impacts are expected
- Impact objects missing `summary`
- `upgrade_instructions` file existence

### 8. Report Results

Present a consolidated report:

1. **Commit coverage** — Summarize how many commits were checked, how many were already covered, how many new entries were created, and how many were skipped as internal-only.
2. **Validation warnings** — List any warnings from the validation script that remain unresolved.
3. **Quality enhancements** — Summarize the outcome of Step 6: how many entries were enhanced by subagents and what kinds of improvements were made (truncated summaries repaired, references added, etc.).
4. **Todos reviewed** — Summarize the outcome of Step 3: how many todo items were reviewed, how many the user resolved, and how many remain open.
5. **Condensation** — Summarize the outcome of Step 4: how many entries were merged and the before/after count.
6. **Summary generated** — Whether the top-level summary and highlights were created or updated in Step 5.
7. **Final validation status** — Whether the file now passes all checks.

If there were no findings at all, report:

```
No issues found. The changelog looks complete and well-formed.
```
