[//]: # "Workflow for deeply enhancing a single changelog entry's quality using source context and external research."
[//]: # "Primary goal: improve one entry's summary, description, impacts, action items, and references."

# EnhanceEntry Workflow

Deeply improve a single changelog entry in `main/log.yaml` by analyzing source code context,
researching external references, and refining all fields. This workflow runs non-interactively —
it identifies the target entry, researches it, applies improvements, and reports the result. The
user reviews the output after completion.

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| Entry identifier | Yes | An index number from `list-changes.ts` output, a partial summary text match, or a component name. Used to locate the target entry. |
| Enhancement focus | No | A specific area to focus on (e.g., "improve references", "add description", "fix action items"). When absent, all areas are enhanced. |

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step.

### 1. Gather Context

Run the list-changes script from the skill directory to see all entries with their indices:

```bash
bun ./scripts/list-changes.ts
```

### 2. Identify Target Entry

Match the user's identifier against the list output:

- **Index number**: Match directly against the 1-based entry indices.
- **Partial summary text**: Find the entry whose summary best matches the provided text.
- **Component name**: Find the entry whose impacts include the given component.

If the match is ambiguous, pick the best match and note it in the final report. If no match is found, report the failure and stop.

Then read the full contents of `packages/website/src/content/changelog/main/log.yaml` and locate the target entry.

### 3. Capture Baseline

Record the entry's current state — all fields and their values. This baseline is used in the final before/after report.

### 4. Analyze Source Context

If the entry has `internal-commit` references, run the show-diff script for each commit hash to read the actual code changes:

```bash
bun ./scripts/show-diff.ts <hash>
```

Read relevant source files referenced in the diff to understand the full scope of the change. Look for:

- What components are affected beyond what the entry currently lists
- Whether the change is breaking, and if so, what exactly breaks
- What action items a user would need to take
- The motivation behind the change

If the entry has no `internal-commit` references, skip this step.

### 5. Enhance the Entry

Apply the fixes below based on the user's focus area, or all fixes if no focus was specified. Preserve all fields that are not being enhanced. Do not remove existing data unless it is incorrect or superseded.

#### Fix 1: Repair truncated summaries

Our editing tools sometimes cut summaries off mid-sentence. Detect this and reconstruct the full summary.

**Detection**: A summary is truncated if it does not end with sentence-ending punctuation (`.`, `!`, `)`, `"`, `` ` ``). Trailing whitespace should be stripped before checking.

**Repair**: Use the source context gathered in Step 4 (diffs, commit messages, source files) and any existing `description`, `impacts`, or `action_items` on the entry to reconstruct the complete intended meaning. Write a full, properly-terminated summary that:

- Completes the original sentence naturally — do not simply append a period to a sentence fragment
- Preserves the original wording for the intact portion
- Keeps the same level of specificity and technical detail as the original
- Follows all summary quality standards (user-facing, names the component, describes the observable effect)

If the source context is insufficient to confidently reconstruct the full meaning, write the best completion possible and note the uncertainty in the final report.

#### Fix 2: Remove links from summaries

Summaries are plain text. Markdown links to module documentation pages do not belong in the `summary` field.

**Detection**: The summary contains Markdown link syntax: `[text](/path...)` or `[text](http...)`.

**Repair**: Replace each link with just the link text in backticks. For example, `[`kube_cert_manager`](/docs/edge/reference/infrastructure-modules/...)` becomes `` `kube_cert_manager` ``.

#### Fix 3: Remove component lists from summaries

Summaries should describe the change, not enumerate which components are affected — that belongs in the `impacts` field.

**Detection**: The summary contains a list of discrete component names (e.g., `` `kube_cron_job`, `kube_deployment`, and `kube_stateful_set` ``) or phrases like "for several modules including...".

**Repair**: Remove the component enumeration from the summary and rephrase to describe the change generically (e.g., "all workload modules" or "several Kubernetes modules"). Ensure the listed components are present in the entry's `impacts` array — if any are missing, add them.

#### Fix 4: Research and add missing references

Every entry should have references that help users understand context and find related resources. Apply each research strategy below in order, skipping any that do not apply to the entry. Use `mcp__exa__web_search_exa` and `mcp__exa__get_code_context_exa` for external searches. Do not add duplicate references — check existing references before adding.

**Strategy 1: Third-party tool website or repo** — If the entry focuses primarily on a third-party tool or project (e.g., Loki, KEDA, Linkerd, Cert-Manager), add an `external-docs` reference linking to the tool's official website or GitHub repository. Do not add this for entries that merely mention a tool in passing.

**Strategy 2: Third-party upgrade artifacts** — If the entry describes upgrading a third-party tool to a new version, search for and add `external-docs` references to any of: release notes, GitHub release page, upgrade/migration guide, or announcement blog post for that version.

**Strategy 3: Third-party issue** — If the entry describes a bug, workaround, or incompatibility caused by a third-party tool, search that tool's GitHub repository for a corresponding issue. Add matches as `issue-report` references.

**Strategy 4: Panfactum issue or PR** — Search the `Panfactum/stack` GitHub repository for issues or pull requests related to the change. Use `mcp__exa__web_search_exa` with `site:github.com/Panfactum/stack`. Add matches as `issue-report` or `external-commit` references.

**Strategy 4: Panfactum documentation** — Search the local docs tree (`packages/website/src/content/docs/main/`) for a page that documents the affected component or feature. Use Grep or Glob to find matching `.mdx` files by component name. Derive the link from the file path (e.g., `packages/website/src/content/docs/main/docs/edge/reference/infrastructure-modules/kubernetes/kube_cert_manager/index.mdx` → `/docs/edge/reference/infrastructure-modules/kubernetes/kube_cert_manager`). Add matches as `internal-docs` references.

#### Fix 4: General quality improvements

| Area | Enhancement Criteria |
|------|---------------------|
| **Summary** | Make it clearer, more specific, and user-facing. Name the component, describe the observable effect. Avoid vague phrasing like "Fixes a bug" or "Improves performance". |
| **Description** | Add or improve the "why" — motivation, user benefit, project direction. The summary says *what* changed; the description explains *why* and *where this is heading*. |
| **Impacts** | Add missing impacts, improve impact summaries. Cross-check against the diff to find all affected components. Each impact summary should describe what changed for that specific component. |
| **Action items** | Make them more specific and actionable (especially for breaking changes). Each should start with a verb and be concrete enough to follow without guessing. |
| **Markdown** | Ensure consistent backtick formatting for code, module names, commands, and config keys. |
| **Tone** | Present tense, active voice. Consistent formality with the rest of the changelog. |

### 7. Write Changes

Edit `packages/website/src/content/changelog/main/log.yaml` surgically — modify only the target entry's fields that were enhanced. Preserve all other entries and top-level fields.

MUST follow these rules when writing:

- **Use `>-` block scalar style** for all multi-line `summary` values.
- **Omit optional fields entirely** when they are not applicable — do not include empty arrays or null values.
- **Maintain consistent indentation** (2 spaces) throughout the file.
- **Do not touch other entries** or top-level fields (`summary`, `highlights`, `upgrade_instructions`, `branch`, `skip`).

After writing, read back the modified entry to confirm the changes were applied correctly and the file is still valid YAML.

### 8. Validate the Result

Run the validation script from the skill directory:

```bash
bun ./scripts/validate-changelog.ts
```

If there are WARN-level findings for the enhanced entry, attempt to fix them. If a fix cannot be determined, note it in the report.

### 9. Report Results

Present a before/after comparison for the enhanced entry.
