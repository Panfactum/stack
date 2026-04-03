[//]: # "Workflow for compiling release summary and highlights from existing changelog entries."
[//]: # "Used when preparing a release to generate the top-level summary and highlights fields in log.yaml."

# GenerateSummary Workflow

Compile the `summary` and `highlights` fields for a release by analyzing all existing entries
in `main/log.yaml`. This workflow runs non-interactively — it analyzes entries, generates the
fields, writes them, validates, and reports the result. The user reviews the output after
completion.

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step.

### 1. Read the Changelog

Run the summary inputs script from the skill directory to extract the fields needed for drafting:

```bash
bun ./scripts/list-summary-inputs.ts
```

This outputs any existing `summary` and `highlights`, then each change with its type, summary, action_items, and impacts (references and descriptions are omitted).

Pay close attention to:
- Any existing `summary` and `highlights` fields (note them for comparison in the report)
- All `breaking_change` entries and their `summary` and `action_items`
- All `addition` entries — especially those with a broad impact or new modules
- All `fix` entries that address widely-reported or high-impact issues
- Which changes have `impacts` referencing modules, CLI commands, devshell tools, or configuration files

### 2. Draft the Summary Field

Generate a `summary` — a single sentence that captures the 2–4 most important themes of this release.

**Guidelines for the summary:**

| Guideline | Description |
|-----------|-------------|
| Length | One sentence, 20–40 words |
| Content | Mention 2–4 major themes; use active verbs |
| Tense | Present tense ("Introduces", "Adds", "Consolidates", "Fixes") |
| Scope | Focus on what matters to the user upgrading; skip minor fixes |
| Format | Plain text only — no markdown, backticks, or links |

**Priority for selecting themes:**
1. Breaking changes that affect all users (e.g., new required config, major module consolidations)
2. Major new additions (e.g., new CLI tools, new required modules, new platform capabilities)
3. Notable improvements or fixes with broad impact

**Style examples:**

```yaml
# Good — concise, action-oriented, covers key themes
summary: "Introduces dedicated DNS zones for cluster management, consolidates certificate modules, adds KEDA for autoscaling, and launches the new Panfactum CLI tool."

# Good — two major themes clearly stated
summary: "Adds burstable node support to all cluster modules and fixes RBAC permission issues introduced in the previous release."

# Bad — too vague
summary: "Various improvements and bug fixes."

# Bad — too long, listing everything
summary: "Adds kube_job, fixes RBAC issues, fixes SSO sync, fixes min_node_cpu default, adds AAAA records, adds sub_paths to mounts, and consolidates contact variables."
```

### 3. Draft the Highlights Field

Generate `highlights` — 3–7 bullet points covering the most impactful changes. Each highlight is an inline markdown string.

**Guidelines for highlights:**

| Guideline | Description |
|-----------|-------------|
| Count | 3–7 items |
| Priority | Breaking changes first, then major additions, then notable fixes |
| Format | Backticks for code/module names, markdown links for docs, em dash for context |
| Action | Include what the user must do, if anything |
| Length | One line per highlight — concise, scannable |

**Priority order:**
1. Breaking changes that require immediate user action (all users affected)
2. Breaking changes that affect users in specific configurations
3. Major new additions (new required modules, new tools, significant new capabilities)
4. Notable fixes that resolve widely-impacting issues
5. Deprecations users should plan around

**Style examples:**

```yaml
highlights:
  # Breaking change with action — module name in backticks, action after em dash
  - "New `pf` CLI tool — run `pf devshell sync` then `terragrunt run-all apply` to initialize"

  # Breaking change requiring state migration — clear consequence stated
  - "`kube_cert_manager` and `kube_cert_issuers` consolidated into new `kube_certificates` module — state migration required"

  # Addition with a link to the relevant docs
  - "KEDA added to base cluster — install via [`kube_keda`](/docs/edge/reference/infrastructure-modules/direct/kubernetes/kube_keda)"

  # Breaking change with version number — factual, no fluff
  - "Kubernetes default version updated to 1.31"

  # Behavior change affecting all deployments
  - "`burstable_nodes_enabled` now defaults to `true` for all modules"
```

**Formatting rules:**
- Use backticks around module names, CLI commands, YAML keys, and file names
- Use markdown links `[text](url)` to link to relevant documentation at `/docs/edge/reference/...`
- Use an em dash (`—`) to separate the fact from the action or consequence
- Do not end highlights with a period
- Do not include every change — the `changes` array is the exhaustive list; highlights is the curated shortlist

### 4. Write the Fields to log.yaml

Update `main/log.yaml` to set both the `summary` and `highlights` fields.

**Important constraints:**
- Write the `summary` as a plain quoted YAML string on a single line
- Write each `highlights` item as a quoted YAML string under the `highlights` key
- Preserve all existing `changes`, `upgrade_instructions`, `skip`, and `branch` fields exactly as they are
- Do not reformat, reorder, or alter any existing `changes` entries

If you are uncertain about any aspect of the summary or highlights (e.g., which themes to prioritize, whether a change is significant enough for a highlight, correct wording), add a `todo` item to the `todo` array in `packages/website/src/content/changelog/main/review.yaml` explaining the concern.

After writing, read back the file to confirm changes were applied correctly and the file is still valid YAML.

### 5. Validate the Result

Run validation to confirm the updated file passes all checks:

```bash
bun ./scripts/validate-changelog.ts
```

If validation fails, diagnose and fix the issue before reporting.

### 6. Report Results

Present a summary of everything that was done:

1. **Summary field** — Show the generated summary. If a previous summary existed, show the before and after.
2. **Highlights field** — Show the generated highlights list. If previous highlights existed, show the before and after.
3. **Todos** — List all `todo` items that were added to `review.yaml`. These are questions/concerns that need human review.
4. **Validation findings** — Summarize any WARN or INFO findings.
5. **Upgrade instructions note** — If breaking changes exist, check whether `upgrade.mdx` exists in `main/` and note whether one should be created or updated.
