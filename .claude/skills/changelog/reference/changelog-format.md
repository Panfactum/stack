# Changelog Format Reference
<!-- Authoritative reference for the log.yaml and review.yaml changelog formats. Auto-loaded by SKILL.md. -->

The changelog uses two files per release directory:

- **`log.yaml`** — User-facing changelog data (summary, highlights, changes). Validated by `log.schema.json`.
- **`review.yaml`** — AI review metadata (todo items, validated commit hashes). Validated by `review.schema.json`. Stripped before release.

## Schema Locations

```
packages/website/src/content/changelog/log.schema.json
packages/website/src/content/changelog/review.schema.json
```

Read the log schema to get the current valid values for change types, impact types, reference types, and component names. Component names are dynamically generated from the codebase, so the schema is the only reliable source.

## File Locations

Unreleased changes accumulate in `packages/website/src/content/changelog/main/`. When a new edge release is cut, `main/` is promoted to a versioned directory. The skill only writes to `main/`.

- `packages/website/src/content/changelog/main/log.yaml` — changelog entries
- `packages/website/src/content/changelog/main/review.yaml` — review metadata

## Key Conventions

These conventions are not captured in the schema but are important for consistency.

### YAML Style

- **Use `>-` block scalar style** for multi-line `summary` values (matches existing entries)
- **Omit optional fields entirely** when not applicable — do not include empty arrays or null values
- **2-space indentation** throughout the file

### Change Entries

- **Summaries are user-facing** — write from the end user's perspective, not the developer's. Focus on observable behavior and required actions, not internal implementation details.
- **Be specific in summaries** — vague entries like "Fixes a bug" are unhelpful. Name the component and describe the symptom or effect.
- **One logical change per entry** — if a diff contains two unrelated fixes, create two separate entries
- **All change types can have `action_items`** — include them whenever the change requires user action. Required for `breaking_change`; recommended for any type where users need to do something.
- **All change types SHOULD have `references` whenever possible** — link relevant issues, commits, or docs. Use Exa search tools to find references before concluding none exist.
- **`description` explains the why** — the summary says *what* changed; the description explains the motivation, how it benefits the user, and how it aligns with the short-term and long-term project direction. Include when the change benefits from more context.

### Top-Level Fields (log.yaml)

- **Top-level `summary` is one sentence** — 20–40 words, captures 2–4 major themes of the release. Present tense, active verbs, plain text only (no markdown).
- **Highlights are curated** — 3–7 items max, covering the most impactful changes. Breaking changes first, then additions, then fixes. Use backticks for code/module names, markdown links for docs, em dash for context. Do not end highlights with a period.
- **`upgrade_instructions`** points to an `upgrade.mdx` file in the same directory; only add when breaking changes require complex multi-step migration.

### Top-Level Fields (review.yaml)

- **`todo` captures AI uncertainty** — when the AI is unsure about a change type, summary wording, component mapping, or any other decision, it adds a `todo` item explaining the concern. Each item should have enough context for a human to resolve it. Stripped before release.
- **`validated` tracks reviewed commits** — a list of full 40-character git commit hashes that the ValidateChangelog workflow has already checked for changelog coverage. Prevents re-analysis on subsequent runs. Stripped before release.

### Writing and Editing

- **Never silently drop data** — when editing entries, preserve all fields not part of the requested change
- **Keep edits surgical** — the smallest valid change is the best change. Avoid reformatting YAML that is not part of the edit.
- **Completeness over polish** — filling in missing references, impacts, and action items is far more valuable than tweaking wording
- **Always validate after writing** — run `bun ./scripts/validate-changelog.ts` after any change to `log.yaml`

## Example Entry

```yaml
- type: breaking_change
  summary: >-
    `kube_cert_manager` and `kube_cert_issuers` have been consolidated into a single `kube_certificates` module
    to address various race conditions on cluster installation.
  action_items:
    - "Create a new `kube_certificates` module deployment."
    - "Migrate the Terraform state from both old modules into the new module."
  references:
    - type: internal-commit
      summary: "Consolidate cert modules into kube_certificates"
      link: abc123def456abc123def456abc123def456abcd
    - type: issue-report
      summary: "Race condition during cluster bootstrap with separate cert modules"
      link: https://github.com/Panfactum/stack/issues/138
  impacts:
    - type: iac-module
      component: kube_cert_manager
      summary: Deprecated and consolidated into kube_certificates
    - type: iac-module
      component: kube_certificates
      summary: New module replacing kube_cert_manager and kube_cert_issuers
```
