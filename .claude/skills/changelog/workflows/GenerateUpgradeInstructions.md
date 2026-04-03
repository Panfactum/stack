[//]: # "Workflow for generating upgrade.mdx from breaking changes and deprecations in log.yaml."
[//]: # "Used when the release has breaking changes that require detailed migration instructions."

# GenerateUpgradeInstructions Workflow

Draft an `upgrade.mdx` file from the breaking changes and deprecations in `main/log.yaml`.
This workflow runs non-interactively — it reads existing entries, expands `action_items`
into detailed migration sections, writes the file, validates, and reports the result.
The user reviews the output after completion.

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step.

### 1. Gather Upgrade Items

Run the upgrade items script to extract breaking changes and deprecations:

```bash
bun ./scripts/list-upgrade-items.ts
```

This outputs each `breaking_change` and `deprecation` entry with its `summary`, `action_items`, `impacts`, and `references` — everything needed to draft upgrade sections. It also reports whether `upgrade_instructions` is set in `log.yaml` and whether the referenced file exists.

Also check whether `packages/website/src/content/changelog/main/upgrade.mdx` already exists. If it does, read its contents — you will merge with it in Step 4.

### 2. Determine Whether Upgrade Instructions Are Needed

If there are **no** `breaking_change` or `deprecation` entries, report that no upgrade instructions are needed and stop.

If all breaking changes have only trivial inline `action_items` (single-step, no complex migration), note this but still proceed — the user invoked the workflow explicitly.

### 3. Analyze Dependencies and Draft Upgrade Sections

**Ordering is critical.** Users follow upgrade instructions top-to-bottom. If a section depends on a prior section being completed first, it MUST appear after that section. Getting the order wrong can break clusters, corrupt state, or force users to start over.

#### 3a. Build the Dependency Graph

Before drafting any sections, analyze the breaking changes for ordering constraints:

1. **Explicit dependencies** — Does an action item reference another change? (e.g., "after completing the migration above", "once `kube_keda` is deployed"). These create hard ordering edges.
2. **Module dependencies** — Does one change produce a module/output that another change consumes? Check `impacts` for modules that appear as both a producer in one change and a dependency in another (e.g., `kube_authentik` outputs `organization_name` → `authentik_core_resources` consumes it).
3. **Infrastructure layer ordering** — Changes to foundational layers must come before changes to higher layers. The general order is: bootstrap/IAM → DNS → cluster core → cluster add-ons → workloads → CLI/devshell tooling.
4. **Catch-all steps last** — Any step that says "apply all modules" or "run a global sync" (e.g., `pf devshell sync`, `terragrunt run-all apply`) MUST be the final section, since it assumes all prior migrations are complete.

Produce a linear ordering that respects all dependency edges. If you are uncertain about a dependency, err on the side of placing the prerequisite first and add a `todo` item to `review.yaml` noting the uncertainty.

#### 3b. Draft Sections in Dependency Order

Read the upgrade instruction format reference: @./reference/upgrade-instruction-format.md

For each breaking change and deprecation entry that requires user action, draft a `##` section in the upgrade file **in the order determined by Step 3a**. Follow the single-command principle, section guidelines, and MDX conventions defined in the format reference.

Use Exa search tools (`mcp__exa__web_search_exa`, `mcp__exa__get_code_context_exa`) to find relevant documentation and examples when expanding action items.

If you are uncertain about the correct migration steps for any entry, add a `todo` item to the `todo` array in `packages/website/src/content/changelog/main/review.yaml` explaining the concern.

### 4. Write the File

Write the drafted content to:

```
packages/website/src/content/changelog/main/upgrade.mdx
```

**If the file already exists:**
- Preserve any existing sections that are still relevant (i.e., correspond to breaking changes still present in `log.yaml`)
- Remove sections for breaking changes that no longer exist in `log.yaml`
- Append new sections for breaking changes not yet covered
- Update the `{/* comment */}` header to reflect the current set of changes

**If the file is new:**
- Write the full file with the `{/* comment */}` header and all drafted sections

After writing, check `main/log.yaml` for the `upgrade_instructions` field. If it is not set, update `log.yaml` to add:

```yaml
upgrade_instructions: upgrade.mdx
```

Preserve all other fields in `log.yaml` exactly as they are.

After writing, read back both files to confirm changes were applied correctly.

### 5. Validate the Result

Run validation to confirm the updated file passes all checks:

```bash
bun ./scripts/validate-changelog.ts
```

If validation fails, diagnose and fix the issue before reporting.

### 6. Report Results

Present a summary of everything that was done:

1. **Section order** — List each `##` section in the order it appears in the file, with a brief note on why that position was chosen (e.g., "prerequisite for X", "depends on Y above", "catch-all — must be last").
2. **CLI command coverage** — For each section, note whether it uses an existing `pf` command, or whether a new command is needed. List all missing commands that should be implemented.
3. **Sections preserved** — If merging with an existing file, list sections that were kept unchanged.
4. **Breaking changes covered** — Count of breaking changes and deprecations that have upgrade instructions.
5. **Breaking changes skipped** — List any breaking changes that were not given a section, with the reason (e.g., no user action required).
6. **Todos** — List all `todo` items that were added to `review.yaml`. These are questions/concerns that need human review.
7. **Validation status** — Whether the file passes all checks.
