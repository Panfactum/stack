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

If the script exits with code 1 (required but missing), spawn a subagent to run the **GenerateUpgradeInstructions** workflow (via the changelog skill) to create it before continuing.

### 3. Run the Automated Validation Script

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

### 4. Quality Review

Read the full contents of `packages/website/src/content/changelog/main/log.yaml` and review every entry against these quality checks:

| Check | What to Look For |
|-------|-----------------|
| Summary quality | Clear, concise, user-facing; not vague or overly terse. Names the component and describes the observable effect. |
| Summary specificity | Avoids generic phrasing like "Fixes a bug" or "Improves performance" — should say *what* was fixed or improved. |
| Markdown consistency | Consistent backtick formatting for code, module names, commands, and config keys across all entries. |
| Tone consistency | Consistent tense (present), voice (active), and formality across all entries. |
| Action item quality | Each action item starts with a verb and is specific enough to follow without guessing. |

For each issue found, edit `packages/website/src/content/changelog/main/log.yaml` directly to fix it. Preserve all existing data — only adjust wording, formatting, and tone.

### 5. Review Todo Items

Read the `todo` array from `packages/website/src/content/changelog/main/review.yaml`. If there are no todo items, skip to Step 5.

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

### 6. Report Results

Present a consolidated report:

1. **Commit coverage** — Summarize how many commits were checked, how many were already covered, how many new entries were created, and how many were skipped as internal-only.
2. **Validation warnings** — List any warnings from the validation script that remain unresolved.
3. **Quality fixes** — List any wording, formatting, or tone improvements that were applied in Step 3.
4. **Todos reviewed** — Summarize the outcome of Step 4: how many todo items were reviewed, how many the user resolved, and how many remain open.
5. **Final validation status** — Whether the file now passes all checks.

If there were no findings at all, report:

```
No issues found. The changelog looks complete and well-formed.
```
