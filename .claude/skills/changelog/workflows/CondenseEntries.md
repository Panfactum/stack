[//]: # "Workflow for condensing related and redundant changelog entries into consolidated ones."
[//]: # "Primary goal: reduce noise by merging granular per-commit entries into logical user-facing changes."

# CondenseEntries Workflow

Review all entries in `main/log.yaml` and merge related or redundant entries into consolidated
ones. This workflow runs non-interactively — it analyzes the full changelog, identifies merge
candidates, applies the merges, and reports the result. The user reviews the output after completion.

## Workflow Steps

These workflow steps MUST be followed exactly as written. Do NOT prompt the user for input at any step.

### 1. Load Current Entries

Run the list-changes script from the skill directory to get an overview:

```bash
bun ./scripts/list-changes.ts
```

Then read the full contents of `packages/website/src/content/changelog/main/log.yaml`.
Note the total entry count — this is the baseline for measuring condensation.

### 2. Identify Merge Candidates

Scan every entry and group them into **merge sets** — clusters of entries that should be
collapsed into a single entry. An entry may belong to at most one merge set.

Apply these grouping heuristics (in priority order):

| Heuristic | Description | How to Combine | Example |
|-----------|-------------|----------------|---------|
| **Same feature, iterative fixes** | Multiple fix entries for the same component/feature where later commits correct or refine earlier ones. The final behavior is what matters — intermediate missteps are noise. | Summary describes only the final fixed behavior. Discard intermediate summaries and action_items that reference since-corrected state. Keep all references (they document the fix history). | Five `install.sh` fixes that each correct a different bug in the same script |
| **Same feature, incremental build-up** | Multiple improvement/addition entries that describe successive build-out of a single feature, especially when each entry adds one sub-step of a larger capability. | Write one summary covering the full capability. Union all impacts. Combine descriptions into a single narrative of the complete feature, not a list of incremental steps. Discard per-step summaries. | Eight `pf cluster install` entries each automating one more deployment phase |
| **Fix-then-fix chains** | A fix entry followed by another fix for the same symptom (e.g., "take 2" commits). Only the final resolution matters to users. | Use only the last fix's summary and action_items — earlier attempts are irrelevant to users. Keep all references. Drop descriptions from superseded entries. | `fix: installer user input via pipe` followed by `fix: installer user input via pipe - take 2` |
| **Addition + immediate fix** | An addition entry followed by one or more fix entries for that same addition within the same release. The user never saw the broken state. | Keep the addition's summary, description, and action_items. Silently absorb the fixes — do not mention them in the summary. Keep fix references but drop fix-specific action_items and descriptions. | New CLI command added, then two fixes for that command |
| **Overlapping impacts** | Entries with identical `impacts` arrays (same type + component pairs) that describe facets of the same logical change. | Merge summaries into one that covers both facets. Union action_items and deduplicate. Merge impact summaries for shared components into a single sentence. | Two entries both impacting `[iac-module] kube_opensearch` |

**Do NOT merge entries that:**
- Have different `type` values where the distinction matters to the user (e.g., a `breaking_change` and a `fix` — unless the fix reverts the breakage entirely)
- Affect genuinely different components or features, even if introduced in the same commit
- Are both `breaking_change` entries with distinct action items the user must take separately

For each merge set, record:
- The indices (1-based) of the entries to merge
- A short rationale for why they belong together
- Which entry should serve as the **base** (usually the most comprehensive or the first one)

### 3. Draft Condensed Entries

For each merge set, draft a single replacement entry by combining the source entries:

- **`type`**: Use the most significant type. Priority: `breaking_change` > `deprecation` > `addition` > `improvement` > `fix`. If the set includes a `breaking_change`, the merged entry is a `breaking_change`.
- **`summary`**: Write a new summary that covers the full scope of the merged change. Keep it from the end user's perspective — focus on the net effect, not the development journey. Use `>-` block scalar style for multi-line values.
- **`description`**: Combine descriptions where present. If only some source entries had descriptions, keep the most informative one and incorporate key details from the others. Omit if no source entry had a description.
- **`action_items`**: Union of all action items from source entries, deduplicated. Remove items that are superseded by later fixes (e.g., "use variable X" when a later fix renamed it to Y — keep only Y).
- **`references`**: Union of all references from source entries. Deduplicate by `link` value. Keep all unique references — they document the development history.
- **`impacts`**: Union of all impacts from source entries. Deduplicate by `type` + `component` pair. When two impacts share the same component, merge their summaries into one.

Omit optional fields entirely when they are empty or not applicable.

### 4. Apply Changes

Edit `packages/website/src/content/changelog/main/log.yaml`:

1. For each merge set, **replace the base entry** with the drafted condensed entry.
2. **Remove the other entries** in the merge set (the ones that were folded into the base).
3. Preserve all entries that are not part of any merge set — do not alter them.
4. Maintain the relative order of entries. The condensed entry sits where the base entry was.

MUST follow these rules when writing:

- **Use `>-` block scalar style** for all multi-line `summary` values.
- **Omit optional fields entirely** when not applicable — do not include empty arrays or null values.
- **Maintain consistent indentation** (2 spaces) throughout the file.
- **Do not touch top-level fields** (`summary`, `highlights`, `upgrade_instructions`, `branch`, `skip`) — they are managed by other workflows.

### 5. Validate the Result

Run the validation script:

```bash
bun ./scripts/validate-changelog.ts
```

If there are WARN-level findings for the condensed entries, attempt to fix them (e.g., add missing `action_items` for a `breaking_change`). If a fix cannot be determined, note it in the report.

### 6. Report Results

Present a consolidated report:

1. **Before/after count** — "Condensed N entries into M (reduced by K)."
2. **Merge sets applied** — For each merge set, list:
   - The original entry summaries (abbreviated) that were merged
   - The rationale for merging
   - The condensed entry's type and new summary
3. **Entries unchanged** — Count of entries that were not part of any merge set.
4. **Todos added** — List any `todo` items added to `review.yaml` for uncertain merges.
5. **Validation findings** — Summarize any WARN or INFO findings from the validation script.

If no merge candidates were found, report:

```
No merge candidates found. The changelog entries are already well-consolidated.
```
