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
| Entry identifier | Yes | A change ID (full or partial UUID), an index number from `list-changes.ts` output, a partial summary text match, or a component name. Used to locate the target entry. |
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

- **Change ID**: If the identifier looks like a UUID (or prefix of one), run `bun ./scripts/show-change.ts <id>` to locate the entry directly. If it matches, use that entry and skip the other matching strategies.
- **Index number**: Match directly against the 1-based entry indices.
- **Partial summary text**: Find the entry whose summary best matches the provided text.
- **Component name**: Find the entry whose impacts include the given component.

If the match is ambiguous, pick the best match and note it in the final report. If no match is found, report the failure and stop.

Then read the full contents of `packages/website/src/content/changelog/main/log.yaml` and locate the target entry.

### 3. Capture Baseline

Record the entry's current state — all fields and their values. This baseline is used in the final before/after report.

### 4. Relevance Check

Determine whether this entry describes a change that has meaningful user impact on the Panfactum stack's software utilities — infrastructure modules, CLI tools, developer environment, deployment pipelines, or library code.

**Not user-impacting** (remove these):
- Changes to the Panfactum website (documentation site layout, styling, URL structure, marketing pages)
- Internal CI/CD pipeline changes that don't affect the user-facing release artifacts
- Changes to internal developer tooling or scripts that are not part of the distributed stack
- Cosmetic changes to non-user-facing code (comments, formatting, internal naming)

**User-impacting** (keep these):
- Changes to infrastructure modules (Terraform/OpenTofu)
- Changes to CLI tools or developer shell utilities
- Changes to documentation *content* (guides, references) that reflect actual behavioral changes
- Changes to the devenv, flake, or Nix packages that users consume
- Bug fixes, new features, or breaking changes in any user-facing component

If the entry is **not user-impacting**, remove it from `packages/website/src/content/changelog/main/log.yaml`, report that it was removed and why, and **stop** — do not continue to subsequent steps. Also check if the entry's UUID appears in any `groups[].changes` arrays in the same file and remove it from those arrays too (remove the entire group if its `changes` array would become empty).

If the entry **is user-impacting**, continue to the next step.

### 5. Analyze Source Context

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

### 6. Enhance the Entry

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

#### Fix 5: Wrap code tokens in backticks

All code-like tokens in `summary`, `description`, impact summaries, and `action_items` must use backtick formatting — never double-quoted strings and never bare unwrapped text.

**Tokens that require backticks**: module names (`kube_deployment`), environment variables (`PF_ENVIRONMENT_NAME`), CLI commands and flags (`terraform apply`, `--force`), config keys and file paths (`podAnnotations`, `/etc/panfactum/config.yaml`), file names (`values.yaml`, `Dockerfile`), function/method names, Kubernetes resource kinds (`Deployment`, `CronJob`), version strings when used as identifiers (`v1.2.3`), and any other literal code or technical identifier.

**Detection**: Scan each text field for:
1. **Double-quoted code tokens** — e.g., `"kube_deployment"`, `"PF_ENVIRONMENT_NAME"`, `"terraform apply"`. Look for `"<token>"` where the token contains underscores, dots, slashes, hyphens in identifier patterns, or is otherwise clearly a code/technical term rather than normal English prose.
2. **Bare code tokens** — e.g., `kube_deployment`, `PF_ENVIRONMENT_NAME`, `terraform apply` appearing without any surrounding backticks or quotes. Identifiers with underscores, ALL_CAPS names, dotted paths, and slash-delimited paths are strong signals.

**Repair**: Replace `"<token>"` → `` `<token>` `` and wrap bare tokens with backticks. Do not backtick normal English words or phrases that happen to appear near code — only backtick actual technical identifiers, commands, and literals.

#### Fix 6: Format numbered items as Markdown lists

Descriptions that enumerate multiple points should use a proper Markdown numbered list, not a run-on paragraph with inline numbering.

**Detection**: The `description` field contains inline numbered items — patterns like `1) ...`, `1. ...`, or `(1) ...` — run together in a single paragraph rather than separated onto individual lines.

**Repair**: Rewrite the description so each numbered item starts on its own line as a Markdown ordered list (`1. First item\n2. Second item\n...`). Preserve any introductory sentence before the list as a separate paragraph. Use YAML block scalar style (`>-` or `|`) to keep the multi-line formatting intact.

#### Fix 7: Correct misclassified change types

The `type` field must accurately reflect the nature of the change. Three common misclassifications:

**Misclassification 1: Addition labeled as improvement** — If the entry introduces functionality that did not exist in the previous release (a new module, a new CLI command, a new configuration option, a new integration), it is an `addition`, not an `improvement`. An `improvement` enhances existing behavior — better performance, a more intuitive default, expanded options on an existing feature. If the thing being described had no prior equivalent, change the type to `addition`.

**Misclassification 2: Third-party version bump labeled as improvement** — If the entry's primary purpose is upgrading a third-party dependency to a newer version (e.g., "Upgrade Cilium to 1.16", "Bump cert-manager to v1.15"), it is an `update`, not an `improvement`. The `update` type exists specifically for third-party version bumps. Even if the upgrade incidentally improves behavior, the type should be `update` as long as the version bump is the defining action. Change the type to `update`.

**Misclassification 3: Breaking change not labeled as such** — If the change removes, renames, or alters existing behavior in a way that requires users to take action when upgrading, it is a `breaking_change` regardless of whether it is also an improvement, addition, or update. Signals include: removed or renamed module inputs/outputs, changed defaults that affect existing deployments, removed modules or CLI commands, renamed resources that cause state drift, and changed API contracts. Even a beneficial change is breaking if existing users cannot upgrade without modifying their configuration or running migration steps.

**Detection**: Read the summary, description, and source diffs. Ask: (1) Will existing users need to change anything when upgrading? If yes, it is a `breaking_change`. (2) Did this capability exist before? If not, it is an `addition`. (3) Is the primary action bumping a third-party version? If so, it is an `update`.

**Repair**: Change the `type` field to the correct value. If reclassifying to `breaking_change`, ensure the entry has `action_items` that tell users exactly what to do. Note the reclassification in the final report.

#### Fix 8: Remove user actions from summaries

Summaries describe *what changed*, not *what the user must do*. Instructions for the user belong in `action_items`.

**Detection**: The summary contains imperative instructions or migration guidance — phrases like "Add the new `foo` input to your module", "Run `terraform apply`", "Update your configuration to...", "Set `bar` to `true`", "See the upgrade instructions", or "Follow the migration guide". Any sentence that tells the user to perform a step is a user action.

**Repair**: Remove the user-action language from the summary. If the summary becomes incomplete after removal, rewrite it to describe the change itself (what was added, removed, or modified) without prescribing what the user should do. Ensure the removed guidance exists in the entry's `action_items` — if it does not, add it there.

#### Fix 9: Split bundled third-party upgrades into separate entries

Each third-party version bump should be its own changelog entry unless the components are part of the same toolset. Our consolidation logic sometimes merges unrelated upgrades into a single entry.

**Detection**: An entry with type `update` (or that describes version bumps) mentions upgrading two or more distinct third-party systems in its summary, description, or impacts. For example, an entry that covers both an EBS CSI driver upgrade and an EKS upgrade is incorrectly bundled — these are independent tools with independent release cycles.

**Exception**: Components that are genuinely part of the same toolset may share an entry. For example, `kubectl` and the Kubernetes version in `aws_eks` are tightly coupled and belong together. Similarly, a Helm chart upgrade bundled with its underlying application version is fine. The test is whether the components share a release cycle and upgrading one inherently requires upgrading the other.

**Repair**: Split the entry into separate entries — one per independent third-party upgrade. Each new entry should:
- Have its own UUID (generate a new v4 UUID)
- Have a focused summary naming the specific component and version
- Carry only the impacts relevant to that upgrade
- Retain any references (commits, docs) that apply to it

Preserve the original entry for whichever upgrade it best describes and create new entries for the others. Note the split in the final report.

#### Fix 10: General quality improvements

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
